import GLib from 'gi://GLib';
import GLibUnix from 'gi://GLibUnix';
import Gio from 'gi://Gio';
import {RemoteServer} from '../server.js';

const options = {port: 0, sessionSeconds: Number(GLib.getenv('SMARTPHONE_RC_TEST_SESSION_SECONDS') ?? 2)};
if (ARGV.length) {
    options.address = ARGV[0];
    options.certificate = Gio.TlsCertificate.new_from_files(ARGV[1], ARGV[2]);
}
const server = new RemoteServer(GLib.get_current_dir(), state => {
    print(JSON.stringify({state}));
    if (state === 'pending') {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            server.approve();
            return GLib.SOURCE_REMOVE;
        });
    }
}, input => print(JSON.stringify({input})), options);
print(JSON.stringify({url: server.start()}));
const loop = new GLib.MainLoop(null, false);
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
    server.stop();
    loop.quit();
    return GLib.SOURCE_REMOVE;
});
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 10, () => {
    server.stop();
    print(JSON.stringify({url: server.start()}));
    return GLib.SOURCE_CONTINUE;
});
loop.run();
