import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {DBusPeer, connectToParent, cleanupPeerDirectory} from '../dbus.js';

const directory = GLib.dir_make_tmp('smartphone-rc-peer-XXXXXX');
const server = Gio.DBusServer.new_sync(`unix:path=${directory}/peer`,
    Gio.DBusServerFlags.AUTHENTICATION_REQUIRE_SAME_USER, Gio.dbus_generate_guid(), null, null);
const pid = Gio.Credentials.new().get_unix_pid();
let controller, client;
let endings = 0;
const received = [];
const commands = [];
server.connect('new-connection', (_server, connection) => {
    controller = new DBusPeer(connection, 'controller', message => received.push(message), () => endings++);
    return true;
});
server.start();
async function waitFor(predicate) {
    for (let i = 0; i < 300; i++) {
        if (predicate()) return;
        await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => { resolve(); return GLib.SOURCE_REMOVE; }));
    }
    throw Error('D-Bus fixture timed out');
}
function check(condition, reason) { if (!condition) throw Error(reason); }
const mode = ARGV[0];
try {
    if (mode === 'wrong-parent') {
        let rejected = false;
        try { await connectToParent(server.get_client_address(), pid + 100000); } catch { rejected = true; }
        check(rejected, 'Incorrect parent PID accepted');
        print('PASS: unexpected parent credentials rejected');
    } else {
        const connection = await connectToParent(server.get_client_address(), pid);
        client = new DBusPeer(connection, 'service', message => commands.push(message), () => endings++);
        connection.start_message_processing();
        await waitFor(() => controller);
        if (mode === 'typed') {
            client.send({type: 'ready'});
            client.send({type: 'input', input: {type: 'edit', context: 123, remove: 2, text: 'España 🐧'}});
            controller.send({type: 'start', options: {address: '127.0.0.1', port: 0, sensitivity: {min: 0.5, max: 10}}});
            controller.send({type: 'send', message: {type: 'focus', active: true, sensitive: false, context: 123}});
            controller.send({type: 'send', message: {type: 'volume-state', available: true, output: 0xffffffff, level: 100, muted: false}});
            client.send({type: 'input', input: {type: 'mute', output: 7, muted: true}});
            client.send({type: 'input', input: {type: 'session-action', action: 'lock'}});
            await waitFor(() => received.length === 4 && commands.length === 3);
            check(received[3].input.type === 'session-action' && received[3].input.action === 'lock', 'Session action did not round-trip');
            check(commands[2].message.output === 0xffffffff && commands[2].message.level === 100 &&
                commands[2].message.muted === false && received[2].input.muted === true, 'Volume values did not round-trip');
            check(received[1].input.text === 'España 🐧' && commands[0].options.sensitivity.min === 0.5 && commands[1].message.context === 123,
                'Typed D-Bus values did not round-trip');
            const introspection = await new Promise((resolve, reject) => connection.call(null,
                '/io/github/jfernandz/SmartphoneRC', 'org.freedesktop.DBus.Introspectable', 'Introspect', null,
                new GLib.VariantType('(s)'), Gio.DBusCallFlags.NONE, 2000, null, (source, result) => {
                    try { resolve(source.call_finish(result).deep_unpack()[0]); } catch (error) { reject(error); }
                }));
            check(introspection.includes('State') && introspection.includes('a{sv}'), 'Missing typed interface introspection');
            print('PASS: typed methods, Unicode, nested settings and introspection');
        } else if (mode === 'queue') {
            for (let i = 0; i < 100; i++) client.send({type: 'ready'});
            await waitFor(() => endings > 0);
            check(client._connection === null && client._queue.length === 0, 'Overflow retained D-Bus queue');
            print('PASS: outgoing queue overflow closes peer');
        } else {
            const parameters = mode === 'size'
                ? new GLib.Variant('(a{sv})', [{type: new GLib.Variant('s', 'edit'), text: new GLib.Variant('s', 'x'.repeat(5000))}])
                : new GLib.Variant('()', []);
            const method = mode === 'size' ? 'Input' : 'Ready';
            const count = mode === 'size' ? 1 : 600;
            for (let i = 0; i < count; i++) {
                connection.call(null, '/io/github/jfernandz/SmartphoneRC', 'io.github.jfernandz.SmartphoneRC.Events1', method,
                    parameters, new GLib.VariantType('()'), Gio.DBusCallFlags.NONE, 2000, null, (source, result) => {
                        try { source.call_finish(result); } catch { /* Expected connection rejection. */ }
                    });
            }
            await waitFor(() => endings > 0);
            check(controller._connection === null && received.length <= (mode === 'size' ? 0 : 512), 'Excessive request reached application');
            print(`PASS: incoming ${mode} limit closes peer before dispatch`);
        }
    }
} finally {
    controller?.close(); client?.close(); server.stop(); cleanupPeerDirectory(directory);
}
