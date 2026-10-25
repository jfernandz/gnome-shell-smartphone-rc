import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

import {RateLimit, validateInput} from './protocol.js';
import {isPrivateIPv4} from './network.js';
import {DEFAULT_SENSITIVITY} from './limits.js';

export const PORT = 8844;
const SESSION_COOKIE = '__Host-smartphone_rc';
const TRUST_COOKIE = '__Host-smartphone_rc_trust';

export class RemoteServer {
    constructor(directory, onState, onInput, options = {}) {
        this._address = options.address ?? '127.0.0.1';
        this._port = options.port ?? PORT;
        this._certificate = options.certificate ?? null;
        if (this._address !== '127.0.0.1' && (!isPrivateIPv4(this._address) || !this._certificate))
            throw new Error('Wi-Fi requires a private IPv4 address and a TLS certificate.');
        this._scheme = this._certificate ? 'https' : 'http';
        this._directory = directory;
        const [, manifest] = GLib.file_get_contents(`${directory}/resources.json`);
        this._assets = JSON.parse(new TextDecoder().decode(manifest)).web;
        this._onState = onState;
        this._onInput = onInput;
        this._server = null;
        this._client = null;
        this._expiry = 0;
        this._pairingExpiry = 0;
        this._sessionSecret = null;
        this._sessionExpiry = 0;
        this._sessionSeconds = options.sessionSeconds ?? 1800;
        this._exchangeToken = null;
        this._trusted = options.trusted ?? null;
        this._trustedId = null;
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
        this._token = this._newSecret();
        this._deadline = GLib.get_monotonic_time() + 120 * 1000000;
        this._server = new Soup.Server();
        try {
            if (this._certificate)
                this._server.set_tls_certificate(this._certificate);
            const address = new Gio.InetSocketAddress({
                address: Gio.InetAddress.new_from_string(this._address), port: this._port,
            });
            this._server.listen(address, this._certificate ? Soup.ServerListenOptions.HTTPS : 0);
            this._port = this._server.get_listeners()[0].get_local_address().get_port();
            this._origin = `${this._scheme}://${this._address}:${this._port}`;
        } catch (error) {
            this.stop();
            throw error;
        }
        this._server.add_handler('/', (_server, message, path) => this._serve(message, path));
        this._server.add_handler('/session', (_server, message) => this._sessionRequest(message));
        this._server.add_handler('/control', (_server, message) => {
            const headers = message.get_request_headers();
            if (!this._isOwnHost(message) || message.get_uri().get_path() !== '/control' || headers.get_one('Origin') !== this._origin)
                message.set_status(Soup.Status.FORBIDDEN, null);
        });
        this._server.add_websocket_handler('/control', this._origin, null, (_server, message, _path, connection) =>
            this._acceptConnection(message, connection));
        this._pairingExpiry = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 120, () => {
            this._pairingExpiry = 0;
            this._token = null;
            this.disconnect();
            this._onState('expired');
            return GLib.SOURCE_REMOVE;
        });
        this._onState('listening');
        return `${this._origin}/#${this._token}`;
    }

    _acceptConnection(message, connection) {
        const query = message.get_uri().get_query();
        const now = GLib.get_monotonic_time();
        const trusted = this._trustedRecord(message);
        const session = this._hasSession(message);
        const resuming = session || Boolean(trusted);
        if (trusted && this._client && (!this._approved || this._trustedId !== trusted.id)) {
            connection.close(1008, 'Another browser is connected');
            return;
        }
        if (!resuming && (this._client || !this._token || now > this._deadline || query !== `token=${this._token}`)) {
            connection.close(1008, 'Pairing unavailable');
            return;
        }
        if (resuming && this._client) {
            const previous = this._client;
            this._clearClient(true);
            previous.close(1000, 'Connection replaced');
        }
        if (trusted && !session)
            this._clearSession();
        this._peer = message.get_remote_address().get_address().to_string();
        connection.set_max_incoming_payload_size(2048);
        this._client = connection;
        this._approved = false;
        this._suspended = false;
        this._rate = new RateLimit();
        this._messageId = connection.connect('message', (_connection, type, bytes) => this._handleMessage(type, bytes));
        this._closedId = connection.connect('closed', () => this._clearClient(true));
        if (resuming) {
            if (trusted) {
                this._trustedId = trusted.id;
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
        if (this._approved && !this._sessionActive()) {
            this.disconnect();
            return;
        }
        if (type !== Soup.WebsocketDataType.TEXT || !this._rate.accept(GLib.get_monotonic_time() / 1000)) {
            this.disconnect();
            return;
        }
        if (!this._approved)
            return;
        let input;
        try {
            input = validateInput(JSON.parse(new TextDecoder().decode(bytes.get_data())));
        } catch {
            this.disconnect();
            return;
        }
        if (!input) {
            this.disconnect();
            return;
        }
        if (!['suspend', 'disconnect'].includes(input.type))
            this._touchSession();
        if (input.type === 'disconnect') {
            this.disconnect();
        } else if (input.type === 'suspend') {
            this._suspended = true;
            this.send({type: 'suspended'});
            this._onState('suspended');
        } else if (input.type === 'resume') {
            this._suspended = false;
            this.send({type: 'resumed', exchangeToken: this._issueExchange()});
            this._onState('connected');
        } else if (!this._suspended) {
            this._onInput(input);
        }
    }

    get peer() {
        return this._peer;
    }

    get browserName() {
        return this._trustedId ? this._trusted.get(this._trustedId)?.name : null;
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
        if (this._client && this._approved)
            this._client.send_text(JSON.stringify(message));
    }

    approve(remember = false) {
        if (!this._client || this._approved || GLib.get_monotonic_time() > this._deadline)
            return;
        this._rememberRequested = Boolean(remember && this._trusted);
        this._consumePairing();
        this._authorize();
    }

    _consumePairing() {
        for (const key of ['_expiry', '_pairingExpiry']) {
            if (this[key]) {
                GLib.Source.remove(this[key]);
                this[key] = 0;
            }
        }
        this._token = null;
    }

    setSensitivity(range) {
        this._sensitivity = range;
        this.send({type: 'settings', sensitivity: range});
    }

    checkTrust() {
        if (this._trustedId && !this._trusted.contains(this._trustedId))
            this.disconnect();
    }

    _authorize() {
        this._approved = true;
        this._suspended = false;
        this._touchSession();
        this._client.send_text(JSON.stringify({type: 'approved', exchangeToken: this._issueExchange(), sensitivity: this._sensitivity}));
        this._onState('connected');
    }

    _issueExchange() {
        this._exchangeToken = this._newSecret();
        this._exchangeDeadline = GLib.get_monotonic_time() + 30 * 1000000;
        return this._exchangeToken;
    }

    _cookie(message, name = SESSION_COOKIE) {
        const header = message.get_request_headers().get_one('Cookie') ?? '';
        return header.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
    }

    _trustedRecord(message) {
        return this._trusted?.find(this._cookie(message, TRUST_COOKIE)) ?? null;
    }

    _hasSession(message) {
        return Boolean(this._sessionSecret && this._cookie(message) === this._sessionSecret && this._sessionActive());
    }

    _sessionActive() {
        return GLib.get_monotonic_time() < this._sessionDeadline &&
            (!this._trustedId || this._trusted.contains(this._trustedId));
    }

    _touchSession() {
        this._sessionDeadline = GLib.get_monotonic_time() + this._sessionSeconds * 1000000;
        if (this._trustedId)
            this._trusted.touch(this._trustedId);
        if ((this._sessionSecret || this._approved) && !this._sessionExpiry)
            this._armSessionExpiry();
    }

    _armSessionExpiry() {
        const remaining = Math.max(1, Math.ceil((this._sessionDeadline - GLib.get_monotonic_time()) / 1000));
        this._sessionExpiry = GLib.timeout_add(GLib.PRIORITY_DEFAULT, remaining, () => {
            this._sessionExpiry = 0;
            if (GLib.get_monotonic_time() >= this._sessionDeadline) {
                this.disconnect();
                this._onState('expired');
            } else {
                this._armSessionExpiry();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _clearSession() {
        if (this._sessionExpiry) {
            GLib.Source.remove(this._sessionExpiry);
            this._sessionExpiry = 0;
        }
        this._sessionSecret = null;
        this._exchangeToken = null;
        this._trustedId = null;
        this._rememberRequested = false;
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
        return Boolean(this._client && this._approved && this._exchangeToken && this._sessionActive() &&
            GLib.get_monotonic_time() < this._exchangeDeadline &&
            message.get_request_headers().get_one('Authorization') === `Bearer ${this._exchangeToken}`);
    }

    _setCookie(message, name, secret, age) {
        message.get_response_headers().append('Set-Cookie',
            `${name}=${secret}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`);
    }

    _grantSession(message) {
        const exchange = this._validExchange(message);
        if (!this._hasSession(message) && !exchange)
            return null;
        if (exchange) {
            this._exchangeToken = null;
            if (!this._sessionSecret) {
                this._sessionSecret = this._newSecret();
                this._touchSession();
            }
        }
        let rememberError = null;
        if (exchange && this._rememberRequested) {
            this._rememberRequested = false;
            try {
                const secret = this._newSecret();
                const record = this._trusted.remember(secret);
                this._trustedId = record.id;
                const age = Math.max(1, record.expires - Math.floor(GLib.get_real_time() / 1000000));
                this._setCookie(message, TRUST_COOKIE, secret, age);
            } catch (error) {
                // Keep temporary authorization when persistent enrollment fails.
                rememberError = error.message;
                this.send({type: 'trust-error', message: error.message});
            }
        }
        const age = Math.max(1, Math.ceil((this._sessionDeadline - GLib.get_monotonic_time()) / 1000000));
        this._setCookie(message, SESSION_COOKIE, this._sessionSecret, age);
        return {rememberError};
    }

    _clearClient(allowResume = false) {
        const resumable = allowResume && this._approved && this._sessionSecret && this._sessionActive();
        if (this._expiry) {
            GLib.Source.remove(this._expiry);
            this._expiry = 0;
        }
        this._client.disconnect(this._messageId);
        this._client.disconnect(this._closedId);
        this._client = null;
        this._approved = false;
        this._token = null;
        if (this._pairingExpiry) {
            GLib.Source.remove(this._pairingExpiry);
            this._pairingExpiry = 0;
        }
        this._peer = null;
        this._exchangeToken = null;
        if (resumable) {
            this._onState('reconnecting');
        } else {
            this._clearSession();
            this._onState('disconnected');
        }
    }

    disconnect() {
        this._clearSession();
        if (!this._client)
            return;
        const client = this._client;
        this._clearClient();
        client.close(1000, 'Disconnected by desktop');
    }

    stop() {
        if (this._pairingExpiry) {
            GLib.Source.remove(this._pairingExpiry);
            this._pairingExpiry = 0;
        }
        this.disconnect();
        if (this._server) {
            this._server.disconnect();
            this._server = null;
        }
        this._token = null;
    }
}
