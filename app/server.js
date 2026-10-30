import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

import {RateLimit, validateInput} from '../protocol.js';
import {isPrivateIPv4} from '../network.js';
import {NetworkGuard} from './network-guard.js';
import {DEFAULT_SENSITIVITY} from '../limits.js';
import {SessionAuthorization} from './session-authorization.js';

export const PORT = 8844;
const SESSION_COOKIE = '__Host-smartphone_rc';
const TRUST_COOKIE = '__Host-smartphone_rc_trust';

const PAIRING_LIFETIME_SECONDS = 120;
const MAX_HTTP_HEADER_BYTES = 8192;
const MAX_WEBSOCKET_FRAME_BYTES = 2048;
const MAX_WEBSOCKET_MESSAGE_BYTES = 2048;
const MAX_AUTHENTICATION_MESSAGE_BYTES = 256;
const MAX_HTTP_PATH_CHARACTERS = 256;

export class RemoteServer {
    constructor(directory, onState, onInput, options = {}) {
        if (typeof Soup.WebsocketConnection.prototype.set_max_total_message_size !== 'function')
            throw new Error('libsoup 3.8 or later is required for bounded WebSocket messages.');
        this._address = options.address ?? '127.0.0.1';
        this._port = options.port ?? PORT;
        this._certificate = options.certificate ?? null;
        if (this._address !== '127.0.0.1' && (!isPrivateIPv4(this._address) || !this._certificate))
            throw new Error('LAN access requires a private IPv4 address and a TLS certificate.');
        this._scheme = this._certificate ? 'https' : 'http';
        this._directory = directory;
        const [, manifest] = GLib.file_get_contents(`${directory}/resources.json`);
        this._assets = JSON.parse(new TextDecoder().decode(manifest)).web;
        this._onState = onState;
        this._onInput = onInput;
        this._server = null;
        this._guardOptions = options.networkLimits ?? {};
        this._unauthenticated = new Map();
        this._client = null;
        this._expiry = 0;
        this._pairingExpiry = 0;
        this._authenticationMillis = options.authenticationMillis ?? 5000;
        this._trusted = options.trusted ?? null;
        this._onPairingClosed = options.onPairingClosed;
        this._authorization = new SessionAuthorization(this._trusted, options.sessionSeconds ?? 1800,
            () => this._newSecret(), () => {
                this.disconnect();
                this._onState('expired');
            });
        this._sensitivity = options.sensitivity ?? {...DEFAULT_SENSITIVITY};
    }

    _newSecret() {
        const random = Gio.File.new_for_path('/dev/urandom').read(null);
        try {
            const bytes = random.read_bytes(32, null).get_data();
            if (bytes.length !== 32)
                throw new Error('Could not generate a pairing secret.');
            return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        } finally {
            random.close(null);
        }
    }

    start() {
        this._terminalAction = false;
        this._token = null;
        this._server = new Soup.Server();
        try {
            this._guard = new NetworkGuard(this._server, this._certificate, this._guardOptions);
            this._port = this._guard.listen(this._address, this._port);
            this._origin = `${this._scheme}://${this._address}:${this._port}`;
        } catch (error) {
            this.stop();
            if (error.matches?.(Gio.io_error_quark(), Gio.IOErrorEnum.ADDRESS_IN_USE))
                throw new Error(`Port ${this._port} is already in use. Stop the other service or choose another port in Settings → Service → Network.`, {cause: error});
            throw error;
        }
        for (const path of ['/', '/session', '/control'])
            this._server.add_early_handler(path, (_server, message, requestPath) => this._earlyRequest(message, requestPath));
        this._server.connect('request-finished', (_server, message) => this._guard?.finished(message));
        this._server.add_handler('/', (_server, message, path) => this._serve(message, path));
        this._server.add_handler('/session', (_server, message) => this._sessionRequest(message));
        this._server.add_handler('/control', (_server, message) => {
            const headers = message.get_request_headers();
            if (!this._isOwnHost(message) || message.get_uri().get_path() !== '/control' || headers.get_one('Origin') !== this._origin)
                message.set_status(Soup.Status.FORBIDDEN, null);
        });
        this._server.add_websocket_handler('/control', this._origin, null, (_server, message, _path, connection) =>
            this._acceptConnection(message, connection));
        this._onState('listening');
        return `${this._origin}/`;
    }

    openPairing() {
        if (!this._server || this._client || this._terminalAction)
            return null;
        this.closePairing();
        this._token = this._newSecret();
        this._deadline = GLib.get_monotonic_time() + PAIRING_LIFETIME_SECONDS * 1000000;
        this._pairingExpiry = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, PAIRING_LIFETIME_SECONDS, () => {
            this._pairingExpiry = 0;
            this.closePairing();
            return GLib.SOURCE_REMOVE;
        });
        return `${this._origin}/#${this._token}`;
    }

    closePairing() {
        this._consumePairing();
        for (const [connection, pending] of this._unauthenticated) {
            GLib.Source.remove(pending.timer);
            connection.disconnect(pending.message);
            connection.disconnect(pending.closed);
            connection.close(1008, 'Pairing closed');
        }
        this._unauthenticated.clear();
        if (this._client && !this._approved)
            this.disconnect();
    }

    _earlyRequest(message, path) {
        const headers = message.get_request_headers();
        // Keep HTTP transports short-lived; control uses a separate persistent WebSocket.
        if (path !== '/control')
            message.get_response_headers().replace('Connection', 'close');
        const reject = status => {
            message.get_request_body().set_accumulate(false);
            message.get_response_headers().replace('Connection', 'close');
            message.set_status(status, null);
        };
        let headerBytes = 0;
        headers.foreach((name, value) => {
            if (headerBytes <= MAX_HTTP_HEADER_BYTES)
                headerBytes += value.length > MAX_HTTP_HEADER_BYTES ? value.length : new TextEncoder().encode(`${name}: ${value}\r\n`).length;
        });
        if (headerBytes > MAX_HTTP_HEADER_BYTES) {
            reject(431);
            return;
        }
        if (path.length > MAX_HTTP_PATH_CHARACTERS) {
            reject(414);
            return;
        }
        if (!this._guard.headers(message)) {
            reject(Soup.Status.TOO_MANY_REQUESTS);
            return;
        }
        if (!this._isOwnHost(message) || message.get_uri().get_query() !== null) {
            reject(Soup.Status.FORBIDDEN);
            return;
        }
        const length = headers.get_one('Content-Length');
        if (headers.get_one('Transfer-Encoding') || (length !== null && length !== '0')) {
            reject(Soup.Status.REQUEST_ENTITY_TOO_LARGE);
            return;
        }
        const method = message.get_method();
        if (path === '/control' || path === '/session') {
            const origin = headers.get_one('Origin');
            if ((path === '/control' && (method !== 'GET' || origin !== this._origin)) ||
                (path === '/session' && ((method !== 'GET' && method !== 'POST') ||
                    (origin && origin !== this._origin) || (method === 'POST' && origin !== this._origin))))
                reject(Soup.Status.FORBIDDEN);
        } else if (method !== 'GET') {
            reject(Soup.Status.FORBIDDEN);
        } else if (!Object.hasOwn(this._assets, path)) {
            reject(Soup.Status.NOT_FOUND);
        }
    }

    _acceptConnection(message, connection) {
        connection.set_max_incoming_payload_size(MAX_WEBSOCKET_FRAME_BYTES);
        connection.set_max_total_message_size(MAX_WEBSOCKET_MESSAGE_BYTES);
        connection.set_keepalive_interval(15);
        connection.set_keepalive_pong_timeout(5);
        this._guard.websocket(message, connection);
        const peer = message.get_remote_address().get_address().to_string();
        const trusted = this._trustedRecord(message);
        const session = this._hasSession(message);
        if (session || trusted) {
            this._attachConnection(peer, connection, trusted, session);
            return;
        }
        if (this._unauthenticated.size >= 4 || this._client || !this._token || GLib.get_monotonic_time() > this._deadline) {
            connection.close(1008, 'Pairing unavailable');
            return;
        }
        const clear = () => {
            const pending = this._unauthenticated.get(connection);
            if (!pending)
                return;
            this._unauthenticated.delete(connection);
            GLib.Source.remove(pending.timer);
            connection.disconnect(pending.message);
            connection.disconnect(pending.closed);
        };
        const pending = {};
        pending.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._authenticationMillis, () => {
            // clear() removes this source before it can run again.
            clear();
            connection.close(1008, 'Authentication timed out');
            return GLib.SOURCE_REMOVE;
        });
        pending.closed = connection.connect('closed', clear);
        pending.message = connection.connect('message', (_connection, type, bytes) => {
            let authentication = null;
            try {
                if (type === Soup.WebsocketDataType.TEXT && bytes.get_size() <= MAX_AUTHENTICATION_MESSAGE_BYTES)
                    authentication = JSON.parse(new TextDecoder().decode(bytes.get_data()));
            } catch { /* Reject malformed authentication. */ }
            clear();
            if (authentication?.type !== 'authenticate' || authentication.token !== this._token ||
                typeof authentication.token !== 'string' || !this._token || this._client ||
                GLib.get_monotonic_time() > this._deadline) {
                connection.close(1008, 'Pairing unavailable');
                return;
            }
            this._attachConnection(peer, connection, null, false);
        });
        this._unauthenticated.set(connection, pending);
    }

    _attachConnection(peer, connection, trusted, session) {
        const resuming = session || Boolean(trusted);
        if (trusted && this._client && (!this._approved || this._authorization.trustedId !== trusted.id)) {
            connection.close(1008, 'Another browser is connected');
            return;
        }
        if (resuming && this._client) {
            const previous = this._client;
            this._clearClient(true);
            previous.close(1000, 'Connection replaced');
        }
        if (trusted && !session)
            this._authorization.clear();
        this._cookieAuthenticated = Boolean(resuming);
        this._firstMessage = true;
        this._peer = peer;
        connection.set_max_incoming_payload_size(MAX_WEBSOCKET_FRAME_BYTES);
        this._client = connection;
        this._approved = false;
        this._suspended = false;
        this._rate = new RateLimit();
        this._messageId = connection.connect('message', (_connection, type, bytes) => this._handleMessage(type, bytes));
        this._closedId = connection.connect('closed', () => this._clearClient(true));
        if (resuming) {
            if (trusted) {
                this._authorization.bindTrustedBrowser(trusted.id);
                this._trusted.touch(trusted.id);
            }
            this._consumePairing();
            this._authorize();
            return;
        }
        this._expiry = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            this._expiry = 0;
            this.disconnect();
            return GLib.SOURCE_REMOVE;
        });
        connection.send_text(JSON.stringify({type: 'pending'}));
        this._onState('pending');
    }

    _handleMessage(type, bytes) {
        const first = this._firstMessage;
        this._firstMessage = false;
        if (this._approved && !this._authorization.active()) {
            this.disconnect();
            return;
        }
        if (bytes.get_size() > MAX_WEBSOCKET_MESSAGE_BYTES || type !== Soup.WebsocketDataType.TEXT || !this._rate.accept(GLib.get_monotonic_time() / 1000)) {
            this.disconnect();
            return;
        }
        if (!this._approved)
            return;
        if (this._terminalAction)
            return;
        let input;
        try {
            const packet = JSON.parse(new TextDecoder().decode(bytes.get_data()));
            // A scanned link may arrive with an already valid recovery cookie.
            if (first && this._cookieAuthenticated && bytes.get_size() <= MAX_AUTHENTICATION_MESSAGE_BYTES &&
                packet?.type === 'authenticate' && typeof packet.token === 'string' && /^[a-f0-9]{64}$/.test(packet.token))
                return;
            input = validateInput(packet);
        } catch {
            this.disconnect();
            return;
        }
        if (!input) {
            this.disconnect();
            return;
        }
        if (!['suspend', 'disconnect'].includes(input.type))
            this._authorization.touch(this._approved);
        if (input.type === 'disconnect') {
            this.disconnect();
        } else if (input.type === 'suspend') {
            this._suspended = true;
            this.send({type: 'suspended'});
            this._onState('suspended');
        } else if (input.type === 'resume') {
            this._suspended = false;
            this.send({type: 'resumed', exchangeToken: this._authorization.issueExchange()});
            this._onState('connected');
        } else if (!this._suspended) {
            if (input.type === 'session-action')
                this._terminalAction = true;
            this._onInput(input);
        }
    }

    get peer() {
        return this._peer;
    }

    get browserName() {
        return this._authorization.trustedId ? this._trusted.get(this._authorization.trustedId)?.name : null;
    }

    _isOwnHost(message) {
        return message.get_uri().get_host() === this._address && message.get_uri().get_port() === this._port;
    }

    _serve(message, path) {
        if (!this._isOwnHost(message) || message.get_method() !== 'GET') {
            message.set_status(Soup.Status.FORBIDDEN, null);
            return;
        }
        const file = this._assets[path];
        if (!Object.hasOwn(this._assets, path)) {
            message.set_status(Soup.Status.NOT_FOUND, null);
            return;
        }
        const [, contents] = GLib.file_get_contents(`${this._directory}/${file.file}`);
        const headers = message.get_response_headers();
        headers.replace('Cache-Control', 'no-store');
        headers.replace('Referrer-Policy', 'no-referrer');
        headers.replace('X-Content-Type-Options', 'nosniff');
        headers.replace('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' ${this._origin.replace(/^http/, 'ws')}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
        message.set_status(Soup.Status.OK, null);
        message.set_response(`${file.type}; charset=utf-8`, Soup.MemoryUse.COPY, contents);
    }

    send(message) {
        if (!this._client || !this._approved)
            return;
        if (!this._authorization.active()) {
            this.disconnect();
            return;
        }
        this._client.send_text(JSON.stringify(message));
    }

    approve(remember = false) {
        if (!this._client || this._approved || GLib.get_monotonic_time() > this._deadline)
            return;
        this._authorization.requestRemember(remember);
        this._consumePairing();
        this._authorize();
    }

    _consumePairing() {
        const wasOpen = Boolean(this._token);
        for (const key of ['_expiry', '_pairingExpiry']) {
            if (this[key]) {
                GLib.Source.remove(this[key]);
                this[key] = 0;
            }
        }
        this._token = null;
        if (wasOpen) this._onPairingClosed?.();
    }

    setSensitivity(range) {
        this._sensitivity = range;
        this.send({type: 'settings', sensitivity: range});
    }

    checkTrust() {
        if (this._authorization.trustedId && !this._trusted.contains(this._authorization.trustedId))
            this.disconnect();
    }

    _authorize() {
        this._approved = true;
        this._suspended = false;
        this._authorization.touch(this._approved);
        this._client.send_text(JSON.stringify({type: 'approved', exchangeToken: this._authorization.issueExchange(), sensitivity: this._sensitivity}));
        this._onState('connected');
    }

    _cookie(message, name = SESSION_COOKIE) {
        const header = message.get_request_headers().get_one('Cookie') ?? '';
        return header.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
    }

    _trustedRecord(message) {
        return this._trusted?.find(this._cookie(message, TRUST_COOKIE)) ?? null;
    }

    _hasSession(message) {
        return this._authorization.hasSession(this._cookie(message));
    }

    _sessionRequest(message) {
        const headers = message.get_request_headers();
        const method = message.get_method();
        const origin = headers.get_one('Origin');
        if (!this._isOwnHost(message) || message.get_uri().get_path() !== '/session' ||
            (origin && origin !== this._origin) || (method !== 'GET' && method !== 'POST') ||
            (method === 'POST' && origin !== this._origin)) {
            message.set_status(Soup.Status.FORBIDDEN, null);
            return;
        }
        const trusted = this._trustedRecord(message);
        let authenticated = this._hasSession(message) || Boolean(trusted);
        let rememberError = null;
        if (method === 'POST') {
            const grant = this._grantSession(message);
            if (!grant) {
                message.set_status(Soup.Status.FORBIDDEN, null);
                return;
            }
            authenticated = true;
            rememberError = grant.rememberError;
        } else {
            if (!authenticated && this._cookie(message))
                this._setCookie(message, SESSION_COOKIE, '', 0);
            if (!trusted && this._cookie(message, TRUST_COOKIE))
                this._setCookie(message, TRUST_COOKIE, '', 0);
        }
        message.get_response_headers().replace('Cache-Control', 'no-store');
        message.set_status(Soup.Status.OK, null);
        message.set_response('application/json', Soup.MemoryUse.COPY, JSON.stringify({authenticated, rememberError}));
    }

    _validExchange(message) {
        return Boolean(this._client && this._approved &&
            this._authorization.validExchange(message.get_request_headers().get_one('Authorization')));
    }

    _setCookie(message, name, secret, age) {
        message.get_response_headers().append('Set-Cookie',
            `${name}=${secret}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`);
    }

    _grantSession(message) {
        const exchange = this._validExchange(message);
        if (!this._hasSession(message) && !exchange)
            return null;
        if (exchange)
            this._authorization.consumeExchange(this._approved);
        let rememberError = null;
        if (exchange && this._authorization.consumeRememberRequest()) {
            try {
                const secret = this._newSecret();
                const record = this._trusted.remember(secret);
                this._authorization.bindTrustedBrowser(record.id);
                const age = Math.max(1, record.expires - Math.floor(GLib.get_real_time() / 1000000));
                this._setCookie(message, TRUST_COOKIE, secret, age);
            } catch (error) {
                // Keep temporary authorization when persistent enrollment fails.
                rememberError = error.message;
                this.send({type: 'trust-error', message: error.message});
            }
        }
        this._setCookie(message, SESSION_COOKIE, this._authorization.sessionSecret, this._authorization.cookieAgeSeconds);
        return {rememberError};
    }

    _clearClient(allowResume = false) {
        const resumable = allowResume && this._approved && this._authorization.canResume;
        if (this._expiry) {
            GLib.Source.remove(this._expiry);
            this._expiry = 0;
        }
        this._client.disconnect(this._messageId);
        this._client.disconnect(this._closedId);
        this._client = null;
        this._approved = false;
        this._consumePairing();
        this._peer = null;
        this._authorization.cancelExchange();
        if (resumable) {
            this._onState('reconnecting');
        } else {
            this._authorization.clear();
            this._onState('disconnected');
        }
    }

    disconnect() {
        this._consumePairing();
        this._authorization.clear();
        if (!this._client)
            return;
        const client = this._client;
        this._clearClient();
        client.close(1000, 'Disconnected by desktop');
    }

    stop() {
        for (const [connection, pending] of this._unauthenticated) {
            GLib.Source.remove(pending.timer);
            connection.disconnect(pending.message);
            connection.disconnect(pending.closed);
            connection.close(1001, 'Service stopped');
        }
        this._unauthenticated.clear();
        if (this._pairingExpiry) {
            GLib.Source.remove(this._pairingExpiry);
            this._pairingExpiry = 0;
        }
        this.disconnect();
        if (this._server) {
            this._server.disconnect();
            this._server = null;
        }
        this._guard?.stop();
        this._guard = null;
        this._token = null;
    }
}
