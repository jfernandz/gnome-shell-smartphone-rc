import {exit} from 'system';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';
imports.package.init({name: 'gnome-shell', prefix: '/usr', libdir: '/usr/lib'});
Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
if (GLib.getenv('GSETTINGS_BACKEND') !== 'memory' || !ARGV[0])
    throw new Error('Use GSETTINGS_BACKEND=memory and pass an installed extension directory with compiled schemas.');
const path = ARGV[0];
let failed = false;
const {default: Preferences} = await import(`file://${path}/prefs.js`);
const {TrustedBrowsers} = await import(`file://${path}/trusted.js`);
const [,data] = GLib.file_get_contents(`${path}/metadata.json`);
const metadata = {...JSON.parse(new TextDecoder().decode(data)), path, dir: Gio.File.new_for_path(path)};
const prefs = new Preferences(metadata);
const app = new Adw.Application({application_id: 'local.smartphone_rc.PreferencesTest', flags: Gio.ApplicationFlags.NON_UNIQUE});
function widgets(root) {
    const result = [root];
    for (let child = root.get_first_child(); child; child = child.get_next_sibling())
        result.push(...widgets(child));
    return result;
}
app.connect('activate', () => {
    const window = new Adw.PreferencesWindow({application: app});
    prefs.fillPreferencesWindow(window);
    window.present();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
        try {
            const all = widgets(window);
            const min = all.find(w => w instanceof Adw.SpinRow && w.title === 'Minimum');
            const max = all.find(w => w instanceof Adw.SpinRow && w.title === 'Maximum');
            min.value = 12;
            if (max.value !== 12.5) throw Error('Range ordering not enforced');
            const settings = prefs.getSettings();
            if (settings.get_double('sensitivity-max') !== 12.5) throw Error('Range did not persist');
            all.find(w => w instanceof Gtk.Button && w.label === 'Restore defaults').emit('clicked');
            if (min.value !== 0.5 || max.value !== 10) throw Error('Reset failed');
            const duration = all.find(w => w instanceof Adw.ComboRow && w.title === 'Remember new browsers for');
            if (!duration) throw Error('Trust duration setting missing');
            duration.selected = 0;
            if (settings.get_uint('trust-duration-days') !== 7) throw Error('Trust duration did not persist');
            print('PASS: native preferences render, enforce range order, save defaults and configure trust lifetime');
            settings.set_string('trusted-browsers', JSON.stringify([{id:'ab'.repeat(32), name:'Test phone', created:1000000000,lastUsed:1000000000,expires:2000000000}]));
            const refreshed = widgets(window);
            const device = refreshed.find(w => w instanceof Adw.ActionRow && w.title === 'Test phone');
            if (!device || !device.subtitle.includes('Last used:')) throw Error('Integrated browser row missing');
            const trusted = new TrustedBrowsers(prefs.getSettings());
            trusted.touch('ab'.repeat(32));
            if (widgets(window).find(w => w instanceof Adw.ActionRow && w.title === 'Test phone') !== device)
                throw Error('Metadata update replaced the browser row');
            refreshed.find(w => w instanceof Gtk.Button && w.tooltip_text === 'Rename device').emit('clicked');
            const dialog = window.get_visible_dialog();
            if (!(dialog instanceof Adw.AlertDialog)) throw Error('Rename dialog missing');
            dialog.extra_child.text = 'Renamed phone';
            widgets(dialog).find(w => w instanceof Gtk.Button && w.label === 'Save').emit('clicked');
            if (trusted.list()[0].name !== 'Renamed phone' || device.title !== 'Renamed phone') throw Error('Rename failed');
            widgets(window).find(w => w instanceof Gtk.Button && w.label === 'Forget').emit('clicked');
            if (trusted.list().length !== 0) throw Error('Forget failed');
            print('PASS: native trusted-device preferences update, rename and revoke records');
        } catch (error) {
            printerr(`${error.message}\n${error.stack}`);
            failed = true;
        }
        window.close(); app.quit();
        return GLib.SOURCE_REMOVE;
    });
});
app.run([]);
if (failed)
    exit(1);
