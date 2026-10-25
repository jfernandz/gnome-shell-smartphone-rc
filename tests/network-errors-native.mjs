import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {createNetworkGroup} from '../preferences/network.js';
if (!GLib.getenv('SMARTPHONE_RC_NETWORK_TEST')) throw Error('Use a temporary XDG_CONFIG_HOME and set SMARTPHONE_RC_NETWORK_TEST=1.');
Adw.init();
const tools = `${GLib.get_user_config_dir()}/test-tools`;
GLib.mkdir_with_parents(tools, 0o700);
const originalPath = GLib.getenv('PATH');
GLib.setenv('PATH', tools, true);
const page = new Adw.PreferencesPage();
const window = new Adw.PreferencesWindow();
window.add(page);
const network = createNetworkGroup();
page.add(network.group);
window.present();
function widgets(root) {
    const result = [root];
    for (let child = root.get_first_child(); child; child = child.get_next_sibling()) result.push(...widgets(child));
    return result;
}
function find(Type, title) { return widgets(window).find(w => w instanceof Type && (w.title === title || w.label === title)); }
async function wait(predicate) {
    for (let i = 0; i < 100; i++) {
        if (predicate()) return;
        await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => { resolve(); return GLib.SOURCE_REMOVE; }));
    }
    throw Error('Native error state timed out');
}
function ip(output) {
    const file = Gio.File.new_for_path(`${tools}/ip`);
    GLib.file_set_contents(file.get_path(), `#!/bin/sh\nprintf '%s\\n' '${output}'\n`);
    file.set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
}
try {
    await wait(() => find(Adw.ActionRow, 'Address detection failed'));
    if (!find(Adw.ActionRow, 'Address detection failed').subtitle.includes('iproute2 is required'))
        throw Error('Missing iproute2 message was not shown');
    ip('[{"ifname":"test0","addr_info":[{"local":"192.168.5.4"}]}]');
    find(Gtk.Button, 'Refresh').emit('clicked');
    await wait(() => find(Adw.EntryRow, 'LAN IPv4 address').text === '192.168.5.4');
    if (!find(Adw.ActionRow, 'Addresses refreshed')) throw Error('Refresh left stale discovery error visible');
    const configure = find(Gtk.Button, 'Configure');
    configure.emit('clicked');
    await wait(() => find(Adw.ActionRow, 'Configuration failed') && configure.sensitive);
    if (!find(Adw.ActionRow, 'Configuration failed').subtitle.includes('OpenSSL is required'))
        throw Error('Missing OpenSSL message was not shown');
    if (!find(Adw.EntryRow, 'LAN IPv4 address').sensitive || !find(Adw.SpinRow, 'Port').sensitive)
        throw Error('Failed configuration left controls disabled');
    ip('[]');
    find(Gtk.Button, 'Refresh').emit('clicked');
    await wait(() => find(Adw.ActionRow, 'No private LAN IPv4 address found'));
    print('PASS: native Settings shows missing iproute2/OpenSSL and no-address messages, supports Refresh and restores controls');
} finally {
    network.destroy();
    window.close();
    GLib.setenv('PATH', originalPath, true);
}
