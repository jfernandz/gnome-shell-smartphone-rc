import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

const now = () => GLib.get_monotonic_time() / 1000000;

class Budget {
    constructor(rate, burst) {
        this.rate = rate;
        this.burst = burst;
        this.tokens = burst;
        this.updated = now();
    }

    take() {
        const time = now();
        this.tokens = Math.min(this.burst, this.tokens + (time - this.updated) * this.rate);
        this.updated = time;
        if (this.tokens < 1)
            return false;
        this.tokens--;
        return true;
    }
}

// Own TCP acceptance so connection and handshake limits apply before HTTP parsing.
export class NetworkGuard {
    constructor(server, certificate, options = {}) {
        this._server = server;
        this._certificate = certificate;
        this._max = options.maxConnections ?? 32;
        this._perPeer = options.maxPeerConnections ?? 16;
        this._seconds = options.requestSeconds ?? 5;
        this._connections = new Map();
        this._acceptBudget = new Budget(32, 96);
        this._requestBudget = new Budget(120, 160);
        this._peers = new Map();
        this._timer = 0;
    }

    listen(address, port) {
        this._listener = new Gio.SocketService();
        const [, effective] = this._listener.add_address(new Gio.InetSocketAddress({
            address: Gio.InetAddress.new_from_string(address), port,
        }), Gio.SocketType.STREAM, Gio.SocketProtocol.TCP, null);
        this._incoming = this._listener.connect('incoming', (_service, connection) => {
            this._accept(connection);
            return true;
        });
        this._listener.start();
        return effective.get_port();
    }

    _key(address) {
        return `${address.get_address().to_string()}:${address.get_port()}`;
    }

    _accept(connection) {
        this._reap();
        connection.get_socket().set_blocking(false);
        const remote = connection.get_remote_address();
        const peer = remote.get_address().to_string();
        const count = [...this._connections.values()].filter(slot => slot.peer === peer).length;
        if (this._connections.size >= this._max || count >= this._perPeer || !this._acceptBudget.take()) {
            connection.close(null);
            return;
        }
        if (!this._peers.has(peer)) {
            if (this._peers.size >= 256) {
                connection.close(null);
                return;
            }
            this._peers.set(peer, {accept: new Budget(16, 64), requests: new Budget(60, 100), used: now()});
        }
        const budget = this._peers.get(peer);
        budget.used = now();
        if (!budget.accept.take()) {
            connection.close(null);
            return;
        }
        const key = this._key(remote);
        const slot = {connection, peer, phase: 'headers', deadline: now() + this._seconds,
            cancellable: new Gio.Cancellable(), stream: connection};
        this._connections.set(key, slot);
        if (!this._timer) {
            this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
                this._reap();
                if (this._connections.size)
                    return GLib.SOURCE_CONTINUE;
                this._timer = 0;
                return GLib.SOURCE_REMOVE;
            });
        }
        const accept = () => {
            if (!this._connections.has(key))
                return;
            slot.deadline = now() + this._seconds;
            try {
                this._server.accept_iostream(slot.stream, connection.get_local_address(), remote);
            } catch {
                this._close(key);
            }
        };
        if (this._certificate) {
            slot.phase = 'handshake';
            slot.stream = Gio.TlsServerConnection.new(connection, this._certificate);
            slot.stream.handshake_async(GLib.PRIORITY_DEFAULT, slot.cancellable, (stream, result) => {
                try {
                    stream.handshake_finish(result);
                    slot.phase = 'headers';
                    accept();
                } catch {
                    this._close(key);
                }
            });
        } else {
            accept();
        }
    }

    headers(message) {
        const remote = message.get_remote_address();
        const slot = remote ? this._connections.get(this._key(remote)) : null;
        if (!slot)
            return false;
        slot.phase = 'request';
        slot.deadline = now() + this._seconds;
        const budget = this._peers.get(slot.peer);
        budget.used = now();
        return this._requestBudget.take() && budget.requests.take();
    }

    finished(message) {
        const remote = message.get_remote_address();
        const slot = remote ? this._connections.get(this._key(remote)) : null;
        if (slot && slot.phase !== 'websocket' &&
            (message.get_request_headers().get_one('Connection')?.toLowerCase() === 'close' ||
                message.get_response_headers().get_one('Connection')?.toLowerCase() === 'close')) {
            slot.phase = 'closing';
            slot.deadline = now();
            return;
        }
        if (slot && slot.phase !== 'websocket') {
            slot.phase = 'headers';
            slot.deadline = now() + 15;
        }
    }

    websocket(message, connection) {
        const slot = this._connections.get(this._key(message.get_remote_address()));
        if (slot) {
            slot.phase = 'websocket';
            slot.websocket = connection;
        }
    }

    _close(key) {
        const slot = this._connections.get(key);
        if (!slot)
            return;
        this._connections.delete(key);
        slot.cancellable.cancel();
        // Closing the underlying socket also interrupts an incomplete TLS handshake.
        try { slot.connection.get_socket().close(); } catch { /* Already closed. */ }
    }

    _reap() {
        for (const [key, slot] of this._connections) {
            if (slot.websocket?.get_state() === Soup.WebsocketState.CLOSING)
                slot.closeDeadline ??= now() + 2;
            if ((slot.closeDeadline && now() >= slot.closeDeadline) || slot.connection.get_socket().is_closed() || slot.stream.is_closed() ||
                slot.connection.get_socket().condition_check(GLib.IOCondition.HUP | GLib.IOCondition.ERR) ||
                (slot.phase !== 'websocket' && now() >= slot.deadline) ||
                (slot.websocket && slot.websocket.get_state() === Soup.WebsocketState.CLOSED))
                this._close(key);
        }
        for (const [peer, budget] of this._peers) {
            if (now() - budget.used > 60 && ![...this._connections.values()].some(slot => slot.peer === peer))
                this._peers.delete(peer);
        }
    }

    stop() {
        if (this._timer) {
            GLib.Source.remove(this._timer);
            this._timer = 0;
        }
        if (this._listener) {
            this._listener.stop();
            this._listener.disconnect(this._incoming);
            this._listener.close();
            this._listener = null;
        }
        for (const key of this._connections.keys())
            this._close(key);
        this._peers.clear();
    }
}
