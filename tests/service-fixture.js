import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GLibUnix from 'gi://GLibUnix';
import {RemoteService} from '../service.js';
import {TrustedBrowsers} from '../trusted.js';

const directory = ARGV[0];
const options = {address: ARGV[1] ?? '127.0.0.1', port: Number(GLib.getenv('SMARTPHONE_RC_TEST_PORT') ?? 0)};
if (ARGV[2]) {
    options.certificatePath = ARGV[2];
    options.privateKeyPath = ARGV[3];
}
const source = Gio.SettingsSchemaSource.new_from_directory(`${directory}/schemas`, Gio.SettingsSchemaSource.get_default(), false);
const settings = new Gio.Settings({settings_schema: source.lookup('org.gnome.shell.extensions.smartphone-rc', false)});
if (GLib.getenv('SMARTPHONE_RC_TEST_TRUST_DAYS')) {
    settings.set_uint('trust-duration-days', Number(GLib.getenv('SMARTPHONE_RC_TEST_TRUST_DAYS')));
    Gio.Settings.sync();
}
const trusted = new TrustedBrowsers(settings);
const seed = GLib.getenv('SMARTPHONE_RC_TEST_OTHER_CREDENTIAL');
if (seed && !trusted.find(seed)) trusted.remember(seed, 'Another test browser');
const loop = new GLib.MainLoop(null, false);
let service;
async function start() {
    service?.stop();
    service = new RemoteService(directory, state => {
        print(JSON.stringify({state}));
        if (state === 'connected') service.send({type: 'volume-state', available: true, output: 7, level: 40, muted: false});
        if (state === 'pending') GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            service.approve(Boolean(GLib.getenv('SMARTPHONE_RC_TEST_TRUST')));
            return GLib.SOURCE_REMOVE;
        });
    }, input => print(JSON.stringify({input})), options,
    message => print(JSON.stringify({failure: message})));
    try {
        const startup = service.start();
        if (service._dbusServer) print(JSON.stringify({startingAddress: service._dbusServer.get_client_address()}));
        const result = await startup;
        options.port = Number(result.url.split('/')[2].split(':')[1]);
        print(JSON.stringify({url: result.url, pid: Number(service._process.get_identifier()),
            address: service._dbusServer.get_client_address(), peerDirectory: service._peerDirectory}));
    } catch (error) {
        print(JSON.stringify({failure: error.message}));
    }
}
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 15, () => { service.stop(); loop.quit(); return GLib.SOURCE_REMOVE; });
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 10, () => { start(); return GLib.SOURCE_CONTINUE; });
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 12, () => { trusted.forgetAll(); return GLib.SOURCE_CONTINUE; });
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 1, () => {
    const record = trusted.list().find(item => item.name === 'My phone');
    if (record) trusted.forget(record.id);
    return GLib.SOURCE_CONTINUE;
});
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 28, () => { service._process.force_exit(); return GLib.SOURCE_CONTINUE; });
start();
loop.run();
