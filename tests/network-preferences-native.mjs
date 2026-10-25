import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import {createNetworkGroup} from '../preferences/network.js';
import {readNetworkConfig} from '../network-config.js';
if (!GLib.getenv('SMARTPHONE_RC_NETWORK_TEST')) throw Error('Use a temporary XDG_CONFIG_HOME and set SMARTPHONE_RC_NETWORK_TEST=1.');
Adw.init();
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
const delay = () => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => { resolve(); return GLib.SOURCE_REMOVE; }));
try {
    const all = widgets(window);
    const choices = all.find(w => w instanceof Adw.ComboRow && w.title === 'Detected addresses');
    for (let i = 0; i < 100 && !choices.model.get_n_items(); i++) await delay();
    if (!choices.model.get_n_items()) throw Error('No detected addresses');
    all.find(w => w instanceof Adw.SpinRow && w.title === 'Port').value = 9443;
    const button = all.find(w => w instanceof Gtk.Button && w.label === 'Configure');
    button.emit('clicked');
    for (let i = 0; i < 200 && !button.sensitive; i++) await delay();
    const config = readNetworkConfig();
    if (config.port !== 9443) throw Error('Selected port was not saved');
    if (!widgets(window).some(w => w instanceof Adw.ActionRow && w.title.startsWith('Configured: https://'))) throw Error('Missing success state');
    print('PASS: native Network preferences detect addresses and configure certificate/port');
} finally { network.destroy(); window.close(); }
