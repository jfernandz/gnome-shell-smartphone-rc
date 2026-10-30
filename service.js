import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {DBusPeer, isExpectedPeer, cleanupPeerDirectory} from './dbus.js';
import {RateLimit, validateInput} from './protocol.js';
import {isSensitivityRange} from './limits.js';
import {isStartupResponse} from './service-validation.js';

const STATES = new Set(['listening', 'pending', 'connected', 'disconnected', 'expired', 'suspended', 'reconnecting']);

export class RemoteService {
    constructor(directory, onState, onInput, options, onFailure) {
        this._directory = directory;
        this._onState = onState;
        this._onInput = onInput;
        this._onFailure = onFailure;
        this._options = options;
        this._process = null;
        this._peer = null;
        this._dbusServer = null;
        this._peerDirectory = null;
        this._ready = false;
        this._startup = 0;
        this._state = 'off';
        this._rate = new RateLimit();
    }

    start() {
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
            const limiter = GLib.find_program_in_path('prlimit');
            if (!limiter) {
                this._failed('The util-linux prlimit tool is required to limit the network service. Install util-linux using your system package manager, then start remote control again.');
                return;
            }
            try {
                this._peerDirectory = GLib.dir_make_tmp('smartphone-rc-peer-XXXXXX');
                const path = `${this._peerDirectory}/peer`;
                this._dbusServer = Gio.DBusServer.new_sync(`unix:path=${Gio.dbus_address_escape_value(path)}`,
                    Gio.DBusServerFlags.AUTHENTICATION_REQUIRE_SAME_USER, Gio.dbus_generate_guid(), null, null);
                this._connectionId = this._dbusServer.connect('new-connection', (_server, connection) => {
                    if (!this._process || this._peer || !isExpectedPeer(connection, Number(this._process.get_identifier()))) {
                        connection.close(null, null);
                        return false;
                    }
                    this._peer = new DBusPeer(connection, 'controller', message => this._message(message),
                        () => this._failed('The network service connection ended.'));
                    this._dbusServer.stop();
                    return true;
                });
                this._dbusServer.start();
                const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE});
                launcher.unsetenv('G_MESSAGES_DEBUG');
                const process = launcher.spawnv([limiter, '--nofile=128:128', '--core=0:0', '--data=536870912:536870912', '--',
                    'gjs', '-m', `${this._directory}/app/service-worker.js`, this._dbusServer.get_client_address(),
                    String(Gio.Credentials.new().get_unix_pid()), this._peerDirectory]);
                this._process = process;
                this._startup = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 8000, () => {
                    this._startup = 0;
                    this._failed('The network service did not start in time.');
                    return GLib.SOURCE_REMOVE;
                });
                process.wait_async(null, (child, result) => {
                    try { child.wait_finish(result); } catch { /* A closed child still requires cleanup. */ }
                    if (this._process === process)
                        this._failed('The network service stopped unexpectedly.');
                });
            } catch {
                this._failed('Could not launch the network service.');
            }
        });
    }

    _message(message) {
        if (message.type === 'ready' && this._resolve && !this._ready) {
            this._ready = true;
            this._peer.send({type: 'start', options: this._options});
        } else if (message.type === 'started') {
            if (!isStartupResponse(message, this._options) || !this._resolve || !this._ready || this._state !== 'listening')
                return this._failed('Invalid network service startup response.');
            if (this._startup) GLib.Source.remove(this._startup);
            this._startup = 0;
            const resolve = this._resolve;
            this._resolve = this._reject = null;
            this._fingerprint = message.fingerprint;
            this._origin = message.url.split('/#')[0];
            resolve({url: message.url, fingerprint: message.fingerprint});
        } else if (message.type === 'pairing' && !this._resolve && this._ready &&
            (message.url === null || (typeof message.url === 'string' && message.url.startsWith(`${this._origin}#`) &&
                isStartupResponse({...message, fingerprint: this._fingerprint}, this._options)))) {
            this.onPairing?.(message.url);
        } else if (message.type === 'state' && STATES.has(message.state) &&
            (message.peer === null || (typeof message.peer === 'string' && message.peer.length <= 64)) &&
            (message.browserName === null || (typeof message.browserName === 'string' && message.browserName.length <= 80))) {
            if (!this._ready || (this._resolve && message.state !== 'listening'))
                return this._failed('Invalid network service startup state.');
            this._state = message.state;
            this.peer = message.peer;
            this.browserName = message.browserName;
            this._onState(message.state);
        } else if (message.type === 'input' && this._state === 'connected') {
            const input = validateInput(message.input);
            if (!input || ['suspend', 'resume', 'disconnect'].includes(input.type) ||
                !this._rate.accept(GLib.get_monotonic_time() / 1000))
                return this._failed('Invalid input from the network service.');
            this._onInput(input);
        } else if (message.type === 'error' && typeof message.message === 'string' && message.message.length <= 512) {
            this._failed(message.message);
        } else {
            this._failed('Invalid network service message.');
        }
    }

    _failed(message) {
        const reject = this._reject;
        const running = this._process !== null;
        this._reject = this._resolve = null;
        this.stop();
        if (reject) reject(new Error(message));
        else if (running) this._onFailure(message);
    }

    send(message) { this._peer?.send({type: 'send', message}); }
    approve(remember = false) {
        if (this._state === 'pending' && typeof remember === 'boolean')
            this._peer?.send({type: 'approve', remember});
    }
    openPairing() { this._peer?.send({type: 'open-pairing'}); }
    closePairing() { this._peer?.send({type: 'close-pairing'}); }
    disconnect() { this._peer?.send({type: 'disconnect'}); }
    setSensitivity(sensitivity) {
        if (isSensitivityRange(sensitivity)) {
            // Preserve changes made while the child is still authenticating.
            this._options.sensitivity = sensitivity;
            this._peer?.send({type: 'settings', sensitivity});
        }
    }

    stop() {
        this._state = 'off';
        if (this._startup) GLib.Source.remove(this._startup);
        this._startup = 0;
        this._peer?.close();
        this._peer = null;
        this._ready = false;
        if (this._dbusServer) {
            this._dbusServer.disconnect(this._connectionId);
            this._dbusServer.stop();
            this._dbusServer = null;
        }
        if (this._peerDirectory) {
            cleanupPeerDirectory(this._peerDirectory);
            this._peerDirectory = null;
        }
        const process = this._process;
        this._process = null;
        process?.force_exit();
        const reject = this._reject;
        this._reject = this._resolve = null;
        reject?.(new Error('Service startup cancelled.'));
    }
}
