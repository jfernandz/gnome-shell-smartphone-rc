import {exit} from 'system';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';
// Enable GTK's test accessibility backend before constructing widgets.
GLib.setenv('GTK_A11Y', 'test', true);
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
// Model a ZIP update: Shell can pass old metadata to newly installed preferences.
const prefs = new Preferences({...metadata, 'version-name': '0.0.0'});
const app = new Adw.Application({application_id: 'local.smartphone_rc.PreferencesTest', flags: Gio.ApplicationFlags.NON_UNIQUE});
function widgets(root) {
    const result = [root];
    for (let child = root.get_first_child(); child; child = child.get_next_sibling())
        result.push(...widgets(child));
    return result;
}
app.connect('activate', () => {
    const scheme = GLib.getenv('SMARTPHONE_RC_TEST_COLOR_SCHEME');
    if (scheme)
        Adw.StyleManager.get_default().color_scheme = scheme === 'dark' ? Adw.ColorScheme.FORCE_DARK : Adw.ColorScheme.FORCE_LIGHT;
    const font = GLib.getenv('SMARTPHONE_RC_TEST_FONT');
    if (font) Gtk.Settings.get_default().gtk_font_name = font;
    const window = new Adw.PreferencesWindow({application: app});
    prefs.fillPreferencesWindow(window);
    window.present();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
        (async () => {
            try {
                if (scheme && Adw.StyleManager.get_default().dark !== (scheme === 'dark'))
                    throw Error('Requested native color scheme was not applied');
                const expectedPages = ['network', 'pointer', 'security', 'devices', 'about'];
                const pages = widgets(window).filter(widget => widget instanceof Adw.PreferencesPage && expectedPages.includes(widget.name));
                if (pages.map(page => page.name).join(',') !== expectedPages.join(','))
                    throw Error(`Settings pages are missing or out of order: ${pages.map(page => page.name)}`);
                for (const page of pages) {
                    window.set_visible_page_name(page.name);
                    if (window.get_visible_page() !== page || !page.title || !page.icon_name)
                        throw Error('Settings page navigation failed');
                }
                const networkPage = pages.find(page => page.name === 'network');
                const securityPage = pages.find(page => page.name === 'security');
                for (const title of ['Certificate SHA-256', 'Certificate expires', 'Verify the PC certificate before approval']) {
                    if (widgets(networkPage).some(widget => widget instanceof Adw.ActionRow && widget.title === title) ||
                        !widgets(securityPage).some(widget => widget instanceof Adw.ActionRow && widget.title === title))
                        throw Error('Certificate details must appear only on the Security page');
                }
                const autoStop = widgets(securityPage).find(w => w instanceof Adw.SwitchRow && w.title === 'Stop remote control automatically');
                const stopDuration = widgets(securityPage).find(w => w instanceof Adw.SpinRow && w.title === 'Duration (minutes)');
                if (!autoStop || !stopDuration || autoStop.active || stopDuration.value !== 30 || stopDuration.sensitive)
                    throw Error('Automatic stop must default to off with a disabled 30-minute duration');
                autoStop.active = true;
                stopDuration.value = 90;
                const stopSettings = prefs.getSettings();
                if (!stopSettings.get_boolean('auto-stop-enabled') || stopSettings.get_uint('auto-stop-minutes') !== 90 || !stopDuration.sensitive)
                    throw Error('Automatic stop controls did not save settings');
                stopSettings.set_uint('auto-stop-minutes', 1440);
                stopSettings.set_boolean('auto-stop-enabled', false);
                if (stopDuration.value !== 1440 || autoStop.active || stopDuration.sensitive)
                    throw Error('Automatic stop controls did not follow external settings changes');
                stopSettings.reset('auto-stop-minutes');
                print('PASS: automatic stop defaults, native controls and external settings synchronization');
                const screenshot = GLib.getenv('SMARTPHONE_RC_TEST_SCREENSHOT');
                const delay = () => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 180, () => {
                    resolve(); return GLib.SOURCE_REMOVE;
                }));
                function capture(filename) {
                    const snapshot = new Gtk.Snapshot();
                    new Gtk.WidgetPaintable({widget: window}).snapshot(snapshot, window.get_width(), window.get_height());
                    const texture = window.get_renderer().render_texture(snapshot.to_node(), null);
                    if (!texture.save_to_png(filename)) throw Error('Could not save native preview');
                }
                for (const name of expectedPages) {
                    window.set_visible_page_name(name);
                    await delay();
                    window.child_focus(Gtk.DirectionType.TAB_FORWARD);
                    await delay();
                    if (!window.get_focus()?.get_mapped())
                        throw Error(`Keyboard focus cannot reach the ${name} page`);
                    if (screenshot)
                        capture(screenshot.replace(/\.png$/, `-${name}.png`));
                }
                window.set_visible_page_name('network');
                await delay();
                if (screenshot) {
                    capture(screenshot);
                    window.set_default_size(420, 680);
                    await delay();
                    capture(screenshot.replace(/\.png$/, '-narrow.png'));
                    if (window.get_width() > 420)
                        throw Error('Settings cannot fit a narrow window');
                    window.set_default_size(760, 680);
                    await delay();
                }
                print('PASS: five named Settings pages switch correctly, allow keyboard focus and adapt to a narrow window');
                window.set_visible_page_name('about');
                const all = widgets(window);
                const version = all.find(w => w instanceof Adw.ActionRow && w.title === 'Installed version');
                if (version?.subtitle !== metadata['version-name']) throw Error('About version does not match installed metadata');
                const sessionVersion = all.find(w => w instanceof Adw.ActionRow && w.title === 'GNOME session version');
                if (sessionVersion?.subtitle !== '0.0.0') throw Error('Cached session version not distinguished from installed version');
                const repository = all.find(w => w instanceof Gtk.LinkButton && w.uri === metadata.url);
                if (repository?.uri !== metadata.url) throw Error('About repository does not match installed metadata');
                const linkContent = widgets(repository);
                if (!linkContent.some(widget => widget instanceof Gtk.Label && widget.label === 'Source code') ||
                    !linkContent.some(widget => widget instanceof Gtk.Image && widget.gicon?.get_file()?.get_basename() === 'github-symbolic.svg'))
                    throw Error('Source code link must show its text and GitHub icon');
                if (!Gtk.test_accessible_has_property(repository, Gtk.AccessibleProperty.LABEL))
                    throw Error('Source code link lacks an explicit accessible name');
                print('PASS: About displays installed metadata version and repository');
                window.set_visible_page_name('pointer');
                const min = all.find(w => w instanceof Adw.SpinRow && w.title === 'Minimum');
                const max = all.find(w => w instanceof Adw.SpinRow && w.title === 'Maximum');
                min.value = 12;
                if (max.value !== 12.5) throw Error('Range ordering not enforced');
                const settings = prefs.getSettings();
                if (settings.get_double('sensitivity-max') !== 12.5) throw Error('Range did not persist');
                all.find(w => w instanceof Gtk.Button && w.label === 'Restore defaults').emit('clicked');
                if (min.value !== 0.5 || max.value !== 10) throw Error('Reset failed');
                window.set_visible_page_name('security');
                all.find(widget => widget instanceof Adw.ButtonRow && widget.title === 'Renew certificate…').emit('activated');
                await delay();
                if (window.get_visible_page_name() !== 'network' || !window.get_focus()?.is_ancestor(networkPage))
                    throw Error('Certificate renewal must navigate to Network and focus the address');
                window.set_visible_page_name('security');
                const duration = all.find(w => w instanceof Adw.ComboRow && w.title === 'Remember new browsers for');
                if (!duration) throw Error('Trust duration setting missing');
                duration.selected = 0;
                if (settings.get_uint('trust-duration-days') !== 7) throw Error('Trust duration did not persist');
                print('PASS: native preferences render, enforce range order, save defaults and configure trust lifetime');
                window.set_visible_page_name('devices');
                settings.set_string('trusted-browsers', JSON.stringify([{id:'ab'.repeat(32), name:'Test phone', created:1000000000,lastUsed:1000000000,expires:2000000000}]));
                const refreshed = widgets(window);
                const device = refreshed.find(w => w instanceof Adw.ActionRow && w.title === 'Test phone');
                if (!device || !device.subtitle.includes('Last used:')) throw Error('Integrated browser row missing');
                for (const action of refreshed.filter(w => w instanceof Gtk.Button && (w.tooltip_text === 'Rename device' || w.label === 'Forget')))
                    if (!Gtk.test_accessible_has_property(action, Gtk.AccessibleProperty.LABEL)) throw Error('Device action lacks an explicit accessible name');
                const trusted = new TrustedBrowsers(prefs.getSettings());
                trusted.touch('ab'.repeat(32));
                if (widgets(window).find(w => w instanceof Adw.ActionRow && w.title === 'Test phone') !== device)
                    throw Error('Metadata update replaced the browser row');
                refreshed.find(w => w instanceof Gtk.Button && w.tooltip_text === 'Rename device').emit('clicked');
                const dialog = window.get_visible_dialog();
                if (!(dialog instanceof Adw.AlertDialog)) throw Error('Rename dialog missing');
                if (!Gtk.test_accessible_has_property(dialog.extra_child, Gtk.AccessibleProperty.LABEL)) throw Error('Rename entry lacks an accessible name');
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
        })();
        return GLib.SOURCE_REMOVE;
    });
});
await app.runAsync([]);
if (failed)
    exit(1);
