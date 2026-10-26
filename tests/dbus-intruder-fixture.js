import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {connectToParent} from '../dbus.js';
let denied = false;
let connection;
try {
    connection = await connectToParent(ARGV[0], Number(ARGV[1]));
    connection.start_message_processing();
    await new Promise((resolve, reject) => connection.call(null, '/io/github/jfernandz/SmartphoneRC',
        'io.github.jfernandz.SmartphoneRC.Events1', 'Ready', new GLib.Variant('()', []),
        new GLib.VariantType('()'), Gio.DBusCallFlags.NONE, 1000, null, (source, result) => {
            try { source.call_finish(result); resolve(); } catch (error) { reject(error); }
        }));
} catch { denied = true; }
finally { if (connection && !connection.is_closed()) connection.close(null, null); }
if (!denied) throw Error('Unrelated process could invoke the controller');
print('PASS: unrelated same-user process rejected before helper connection');
