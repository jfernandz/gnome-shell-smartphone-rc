import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import {RateLimit, validateInput} from './protocol.js';

export const PORT = 8844;
export const ORIGIN = `http://127.0.0.1:${PORT}`;

// This first prototype deliberately accepts only an ADB-forwarded loopback connection.
export class RemoteServer {
    constructor(directory, onState, onInput) {
        this._directory = directory;
        this._onState = onState;
        this._onInput = onInput;
        this._server = null;
        this._client = null;
        this._expiry = 0;
    }

    start() {
        this._token = GLib.uuid_string_random();
        this._deadline = GLib.get_monotonic_time() + 120 * 1000000;
        this._server = new Soup.Server();
        this._server.add_handler('/', (_server, message, path) => this._serve(message, path));
        this._server.add_handler('/control', (_server, message) => {
            const headers = message.get_request_headers();
            if (message.get_uri().get_host() !== '127.0.0.1' || headers.get_one('Origin') !== ORIGIN)
                message.set_status(Soup.Status.FORBIDDEN, null);
        });
        this._server.add_websocket_handler('/control', ORIGIN, null, (_server, message, _path, connection) => {
            const query = message.get_uri().get_query();
            if (this._client || !this._token || GLib.get_monotonic_time() > this._deadline || query !== `token=${this._token}`) {
                connection.close(1008, 'Pairing unavailable');
                return;
            }
            connection.set_max_incoming_payload_size(2048);
            this._client = connection;
            this._approved = false;
            this._rate = new RateLimit();
            this._messageId = connection.connect('message', (_connection, type, bytes) => {
                if (!this._approved)
                    return;
                if (type !== Soup.WebsocketDataType.TEXT || !this._rate.accept(GLib.get_monotonic_time() / 1000)) {
                    this.disconnect();
                    return;
                }
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
        try {
            this._server.listen_local(PORT, Soup.ServerListenOptions.IPV4_ONLY);
        } catch (error) {
            this.stop();
            throw error;
        }
        this._onState('listening');
        return `${ORIGIN}/#${this._token}`;
    }

    _serve(message, path) {
        const files = {'/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css']};
        if (message.get_uri().get_host() !== '127.0.0.1' || message.get_method() !== 'GET') {
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
        headers.replace('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; connect-src ws://127.0.0.1:${PORT}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
        message.set_status(Soup.Status.OK, null);
        message.set_response(`${file[1]}; charset=utf-8`, Soup.MemoryUse.COPY, contents);
    }

    approve() {
        if (!this._client || this._approved)
            return;
        GLib.Source.remove(this._expiry);
        this._expiry = 0;
        this._approved = true;
        this._token = null;
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
        this.disconnect();
        if (this._server) {
            this._server.disconnect();
            this._server = null;
        }
        this._token = null;
    }
}
