import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {createNetworkGroup} from '../preferences/network.js';
import {createSecurityGroup} from '../preferences/security.js';
import {readNetworkConfig} from '../network-config.js';
if (!GLib.getenv('SMARTPHONE_RC_NETWORK_TEST')) throw Error('Use a temporary XDG_CONFIG_HOME and set SMARTPHONE_RC_NETWORK_TEST=1.');
Adw.init();
const page = new Adw.PreferencesPage({name: 'service', title: 'Service'});
const securityPage = new Adw.PreferencesPage({name: 'security', title: 'Security'});
const window = new Adw.PreferencesWindow();
window.add(page);
window.add(securityPage);
const security = createSecurityGroup(new Gio.Settings({schema_id: 'org.gnome.shell.extensions.smartphone-rc'}), () => {
    window.set_visible_page_name('service');
    network.focusAddress();
});
securityPage.add(security.certificateGroup);
securityPage.add(security.group);
const createNetwork = () => createNetworkGroup((config, error) => security.setCertificate(config, error));
let network = createNetwork();
page.add(network.group);
window.present();
function widgets(root) {
    const result = [root];
    for (let child = root.get_first_child(); child; child = child.get_next_sibling()) result.push(...widgets(child));
    return result;
}
const delay = () => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => { resolve(); return GLib.SOURCE_REMOVE; }));
async function wait(predicate) {
    for (let i = 0; i < 200; i++) {
        if (predicate()) return;
        await delay();
    }
    throw Error('Certificate preferences state timed out');
}
function certificateRow(title) {
    return widgets(securityPage).find(w => w instanceof Adw.ActionRow && w.title === title);
}
function assertCertificate(config) {
    if (certificateRow('Certificate SHA-256').subtitle !== config.fingerprint ||
        certificateRow('Certificate expires').subtitle !== config.expires)
        throw Error('Security certificate details do not match the saved configuration');
}
try {
    const choices = widgets(page).find(w => w instanceof Adw.ComboRow && w.title === 'Detected addresses');
    await wait(() => choices.model.get_n_items() > 0);
    if (widgets(page).some(w => w instanceof Adw.ActionRow && ['Certificate SHA-256', 'Certificate expires', 'Verify the PC certificate before approval'].includes(w.title)))
        throw Error('Network still contains certificate details');
    if (!certificateRow('Certificate status').subtitle.startsWith('Not configured'))
        throw Error('Security does not describe the unconfigured certificate');
    async function configure(port) {
        const all = widgets(page);
        all.find(w => w instanceof Adw.SpinRow && w.title === 'Port').value = port;
        const button = all.find(w => w instanceof Gtk.Button && w.label === 'Apply');
        button.emit('clicked');
        await wait(() => button.sensitive);
    }
    await configure(9443);
    const config = await readNetworkConfig();
    if (config.port !== 9443) throw Error('Selected port was not saved');
    if (!widgets(page).some(w => w instanceof Adw.ActionRow && w.title.startsWith('Configured: https://'))) throw Error('Missing success state');
    assertCertificate(config);
    await configure(9444);
    const renewed = await readNetworkConfig();
    if (renewed.port !== 9444 || renewed.fingerprint === config.fingerprint)
        throw Error('Renewal did not replace the certificate');
    assertCertificate(renewed);
    window.set_visible_page_name('security');
    widgets(securityPage).find(w => w instanceof Adw.ButtonRow && w.title === 'Renew certificate…').emit('activated');
    await delay();
    if (window.get_visible_page_name() !== 'service' || !window.get_focus()?.is_ancestor(page))
        throw Error('Renew certificate must open Service and focus its address');
    if ((await readNetworkConfig()).fingerprint !== renewed.fingerprint)
        throw Error('Opening renewal generated a certificate before Apply');
    widgets(page).find(w => w instanceof Adw.EntryRow).text = '8.8.8.8';
    await configure(9444);
    if (!widgets(page).some(w => w instanceof Adw.ActionRow && w.title === 'Configuration failed'))
        throw Error('Invalid configuration was accepted');
    assertCertificate(renewed);
    if ((await readNetworkConfig()).fingerprint !== renewed.fingerprint)
        throw Error('Failed configuration replaced the saved certificate');
    network.destroy();
    page.remove(network.group);
    security.setCertificate(null);
    network = createNetwork();
    page.add(network.group);
    await wait(() => certificateRow('Certificate SHA-256').subtitle === renewed.fingerprint);
    assertCertificate(renewed);
    print('PASS: native Network configures and renews certificates; Security updates, reloads saved details and preserves them after failure');
} finally { network.destroy(); security.destroy(); window.close(); }
