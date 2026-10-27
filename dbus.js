import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const PATH = '/io/github/jfernandz/SmartphoneRC';
const CONTROL = 'io.github.jfernandz.SmartphoneRC.Control1';
const EVENTS = 'io.github.jfernandz.SmartphoneRC.Events1';
const METHODS = {
    [CONTROL]: {Start: 'a{sv}', Approve: 'b', Disconnect: '', Sensitivity: 'dd', Focus: 'bbd', TypingPaused: 's', Volume: 'bddb'},
    [EVENTS]: {Ready: '', Started: 'ss', State: 'sss', Input: 'a{sv}', Failed: 's'},
};
function xml(iface) {
    const methods = Object.entries(METHODS[iface]).map(([name, signature]) => {
        const types = signature === 'a{sv}' ? [signature] : [...signature];
        return `<method name="${name}">${types.map(type => `<arg type="${type}" direction="in"/>`).join('')}</method>`;
    });
    return `<node><interface name="${iface}">${methods.join('')}</interface></node>`;
}
function dictionary(value, depth = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 3)
        throw Error('Invalid D-Bus dictionary');
    const entries = Object.entries(value);
    if (entries.length > 32) throw Error('D-Bus dictionary limit');
    return Object.fromEntries(entries.map(([key, entry]) => {
        if (key.length > 64) throw Error('D-Bus key limit');
        let variant;
        if (typeof entry === 'string') variant = new GLib.Variant('s', entry);
        else if (typeof entry === 'number' && Number.isFinite(entry)) variant = new GLib.Variant('d', entry);
        else if (typeof entry === 'boolean') variant = new GLib.Variant('b', entry);
        else variant = new GLib.Variant('a{sv}', dictionary(entry, depth + 1));
        return [key, variant];
    }));
}
function encode(message, role) {
    if (role === 'controller') {
        switch (message.type) {
        case 'start': return ['Start', [dictionary(message.options)]];
        case 'approve': return ['Approve', [message.remember]];
        case 'disconnect': return ['Disconnect', []];
        case 'settings': return ['Sensitivity', [message.sensitivity.min, message.sensitivity.max]];
        case 'send':
            if (message.message.type === 'volume-state') {
                const {available, output, level, muted} = message.message;
                return ['Volume', [available, output, level, muted]];
            }
            if (message.message.type === 'focus') {
                const {active, sensitive, context} = message.message;
                return ['Focus', [active, sensitive, context]];
            }
            if (message.message.type === 'typing-paused') return ['TypingPaused', [message.message.message]];
            break;
        }
    } else {
        switch (message.type) {
        case 'ready': return ['Ready', []];
        case 'started': return ['Started', [message.url, message.fingerprint ?? '']];
        case 'state': return ['State', [message.state, message.peer ?? '', message.browserName ?? '']];
        case 'input': return ['Input', [dictionary(message.input)]];
        case 'error': return ['Failed', [message.message]];
        }
    }
    throw Error('Invalid D-Bus operation');
}
function decode(method, args) {
    switch (method) {
    case 'Start': return {type: 'start', options: args[0]};
    case 'Approve': return {type: 'approve', remember: args[0]};
    case 'Disconnect': return {type: 'disconnect'};
    case 'Sensitivity': return {type: 'settings', sensitivity: {min: args[0], max: args[1]}};
    case 'Volume': return {type: 'send', message: {type: 'volume-state', available: args[0], output: args[1], level: args[2], muted: args[3]}};
    case 'Focus': return {type: 'send', message: {type: 'focus', active: args[0], sensitive: args[1], context: args[2]}};
    case 'TypingPaused': return {type: 'send', message: {type: 'typing-paused', message: args[0]}};
    case 'Ready': return {type: 'ready'};
    case 'Started': return {type: 'started', url: args[0], fingerprint: args[1] || null};
    case 'State': return {type: 'state', state: args[0], peer: args[1] || null, browserName: args[2] || null};
    case 'Input': return {type: 'input', input: args[0]};
    case 'Failed': return {type: 'error', message: args[0]};
    }
    throw Error('Unknown D-Bus operation');
}

// An authenticated private peer only: no session-bus name, broadcasts or autoactivation.
// Both directions use acknowledged methods to bound the outgoing application queue.
export class DBusPeer {
    constructor(connection, role, onMessage, onEnd) {
        this._connection = connection;
        this._onMessage = onMessage;
        this._onEnd = onEnd;
        this._role = role;
        this._incoming = role === 'controller' ? EVENTS : CONTROL;
        this._outgoing = role === 'controller' ? CONTROL : EVENTS;
        this._queue = [];
        this._sending = false;
        this._cancel = new Gio.Cancellable();
        this._window = 0;
        this._count = 0;
        const implementation = {};
        for (const method of Object.keys(METHODS[this._incoming]))
            implementation[`${method}Async`] = (_args, invocation) => this._receive(method, invocation);
        this._export = Gio.DBusExportedObject.wrapJSObject(xml(this._incoming), implementation);
        this._export.export(connection, PATH);
        connection.set_exit_on_close(false);
        this._closed = connection.connect('closed', () => this._fail());
    }

    _receive(method, invocation) {
        let acknowledged = false;
        try {
            if (!this._connection) throw Error('Closed D-Bus peer');
            const parameters = invocation.get_parameters();
            const now = GLib.get_monotonic_time();
            if (now - this._window >= 1000000) { this._window = now; this._count = 0; }
            if (parameters.get_size() > 4096 || ++this._count > 512)
                throw Error('D-Bus message/rate limit');
            const message = decode(method, parameters.recursiveUnpack());
            invocation.return_value(new GLib.Variant('()', []));
            acknowledged = true;
            this._onMessage(message);
        } catch {
            if (!acknowledged)
                invocation.return_dbus_error('io.github.jfernandz.SmartphoneRC.InvalidRequest', 'Invalid or excessive request');
            this._fail();
        }
    }

    send(message) {
        if (!this._connection) return;
        try {
            const [method, args] = encode(message, this._role);
            const parameters = new GLib.Variant(`(${METHODS[this._outgoing][method]})`, args);
            if (parameters.get_size() > 4096 || this._queue.length >= 64)
                throw Error('D-Bus queue/message limit');
            this._queue.push({method, parameters});
            this._write();
        } catch { this._fail(); }
    }

    _write() {
        if (this._sending || !this._queue.length || !this._connection) return;
        const connection = this._connection;
        const {method, parameters} = this._queue.shift();
        this._sending = true;
        connection.call(null, PATH, this._outgoing, method, parameters, new GLib.VariantType('()'),
            Gio.DBusCallFlags.NO_AUTO_START, 5000, this._cancel, (source, result) => {
                if (this._connection !== connection) return;
                try {
                    source.call_finish(result);
                    this._sending = false;
                    this._write();
                } catch { this._fail(); }
            });
    }

    _fail() {
        const onEnd = this._onEnd;
        this.close();
        onEnd?.();
    }

    close() {
        this._onEnd = null;
        this._cancel.cancel();
        this._queue.length = 0;
        this._export?.unexport();
        this._export = null;
        const connection = this._connection;
        this._connection = null;
        if (connection) {
            connection.disconnect(this._closed);
            if (!connection.is_closed()) connection.close(null, null);
        }
    }
}

export function isExpectedPeer(connection, pid) {
    try {
        const credentials = connection.get_stream().get_socket().get_credentials();
        return credentials.get_unix_user() === Gio.Credentials.new().get_unix_user() &&
            credentials.get_unix_pid() === pid;
    } catch { return false; }
}

export async function connectToParent(address, pid) {
    const connection = await new Promise((resolve, reject) => Gio.DBusConnection.new_for_address(address,
        Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.DELAY_MESSAGE_PROCESSING,
        null, null, (_source, result) => {
            try { resolve(Gio.DBusConnection.new_for_address_finish(result)); } catch (error) { reject(error); }
        }));
    if (!isExpectedPeer(connection, pid)) {
        connection.close(null, null);
        throw Error('Unexpected D-Bus parent credentials');
    }
    return connection;
}

export function cleanupPeerDirectory(directory) {
    if (!directory || !/^smartphone-rc-peer-[a-zA-Z0-9]+$/.test(GLib.path_get_basename(directory))) return;
    GLib.unlink(`${directory}/peer`);
    GLib.rmdir(directory);
}
