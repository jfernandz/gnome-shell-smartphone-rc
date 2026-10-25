import GLib from 'gi://GLib';
import GLibUnix from 'gi://GLibUnix';
import Gio from 'gi://Gio';
import {TrustedBrowsers} from '../trusted.js';
import {RemoteServer} from '../server.js';

const options = {port: Number(GLib.getenv('SMARTPHONE_RC_TEST_PORT') ?? 0), sessionSeconds: Number(GLib.getenv('SMARTPHONE_RC_TEST_SESSION_SECONDS') ?? 2)};
let settings = null;
if (GLib.getenv('SMARTPHONE_RC_TEST_TRUST')) {
    settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.smartphone-rc'});
    options.trusted = new TrustedBrowsers(settings);
    const other = GLib.getenv('SMARTPHONE_RC_TEST_OTHER_CREDENTIAL');
    if (other && !options.trusted.find(other))
        options.trusted.remember(other, 'Another test browser');
}
if (ARGV.length) {
    options.address = ARGV[0];
    options.certificate = Gio.TlsCertificate.new_from_files(ARGV[1], ARGV[2]);
}
const server = new RemoteServer(GLib.get_current_dir(), state => {
    print(JSON.stringify({state}));
    if (state === 'pending') {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            server.approve(Boolean(options.trusted));
            return GLib.SOURCE_REMOVE;
        });
    }
}, input => print(JSON.stringify({input})), options);
const unwatch = options.trusted?.watch(() => server.checkTrust());
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 1, () => {
    options.trusted?.forget(server._trustedId);
    return GLib.SOURCE_CONTINUE;
});
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 12, () => {
    options.trusted?.forgetAll();
    return GLib.SOURCE_CONTINUE;
});
print(JSON.stringify({url: server.start()}));
const loop = new GLib.MainLoop(null, false);
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
    server.stop();
    unwatch?.();
    loop.quit();
    return GLib.SOURCE_REMOVE;
});
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 10, () => {
    server.stop();
    print(JSON.stringify({url: server.start()}));
    return GLib.SOURCE_CONTINUE;
});
loop.run();
