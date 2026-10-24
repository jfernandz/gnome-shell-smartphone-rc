import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

import {RateLimit, validateInput} from './protocol.js';
import {isPrivateIPv4} from './network.js';

export const PORT = 8844;

export class RemoteServer {
    constructor(directory, onState, onInput, options = {}) {
        this._address = options.address ?? '127.0.0.1';
        this._port = options.port ?? PORT;
        this._certificate = options.certificate ?? null;
        if (this._address !== '127.0.0.1' && (!isPrivateIPv4(this._address) || !this._certificate))
            throw new Error('Wi-Fi requires a private IPv4 address and a TLS certificate.');
        this._scheme = this._certificate ? 'https' : 'http';
        this._directory = directory;
        this._onState = onState;
        this._onInput = onInput;
        this._server = null;
        this._client = null;
        this._expiry = 0;
        this._pairingExpiry = 0;
    }

    start() {
        const random = Gio.File.new_for_path('/dev/urandom').read(null);
        try {
            const bytes = random.read_bytes(32, null).get_data();
            if (bytes.length !== 32)
                throw new Error('Could not generate a pairing secret.');
            this._token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        } finally {
            random.close(null);
        }
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
        this._server.add_handler('/control', (_server, message) => {
            const headers = message.get_request_headers();
            if (!this._isOwnHost(message) || message.get_uri().get_path() !== '/control' || headers.get_one('Origin') !== this._origin)
                message.set_status(Soup.Status.FORBIDDEN, null);
        });
        this._server.add_websocket_handler('/control', this._origin, null, (_server, message, _path, connection) => {
            const query = message.get_uri().get_query();
            if (this._client || !this._token || GLib.get_monotonic_time() > this._deadline || query !== `token=${this._token}`) {
                connection.close(1008, 'Pairing unavailable');
                return;
            }
            this._peer = message.get_remote_address().get_address().to_string();
            connection.set_max_incoming_payload_size(2048);
            this._client = connection;
            this._approved = false;
            this._rate = new RateLimit();
            this._messageId = connection.connect('message', (_connection, type, bytes) => {
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
                this._onInput(input);
            });
            this._closedId = connection.connect('closed', () => this._clearClient());
            this._expiry = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
                this._expiry = 0;
                this.disconnect();
                return GLib.SOURCE_REMOVE;
            });
            connection.send_text(JSON.stringify({type: 'pending'}));
            this._onState('pending');
        });
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

    get peer() {
        return this._peer;
    }

    _isOwnHost(message) {
        return message.get_uri().get_host() === this._address && message.get_uri().get_port() === this._port;
    }

    _serve(message, path) {
        const files = {
            '/': ['index.html', 'text/html'],
            '/app.js': ['app.js', 'text/javascript'],
            '/style.css': ['style.css', 'text/css'],
            '/editing.js': ['editing.js', 'text/javascript'],
            '/keyboard.js': ['keyboard.js', 'text/javascript'],
            '/touchpad.js': ['touchpad.js', 'text/javascript'],
        };
        if (!this._isOwnHost(message) || message.get_method() !== 'GET') {
            message.set_status(Soup.Status.FORBIDDEN, null);
            return;
        }
        const file = files[path];
        if (!Object.hasOwn(files, path)) {
            message.set_status(Soup.Status.NOT_FOUND, null);
            return;
        }
        const [, contents] = GLib.file_get_contents(`${this._directory}/web/${file[0]}`);
        const headers = message.get_response_headers();
        headers.replace('Cache-Control', 'no-store');
        headers.replace('Referrer-Policy', 'no-referrer');
        headers.replace('X-Content-Type-Options', 'nosniff');
        headers.replace('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; connect-src ${this._origin.replace(/^http/, 'ws')}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
        message.set_status(Soup.Status.OK, null);
        message.set_response(`${file[1]}; charset=utf-8`, Soup.MemoryUse.COPY, contents);
    }

    send(message) {
        if (this._client && this._approved)
            this._client.send_text(JSON.stringify(message));
    }

    approve() {
        if (!this._client || this._approved || GLib.get_monotonic_time() > this._deadline)
            return;
        GLib.Source.remove(this._expiry);
        this._expiry = 0;
        this._approved = true;
        this._token = null;
        GLib.Source.remove(this._pairingExpiry);
        this._pairingExpiry = 0;
        this._client.send_text(JSON.stringify({type: 'approved'}));
        this._onState('connected');
    }

    _clearClient() {
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
        this._onState('disconnected');
    }

    disconnect() {
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
