import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {sensitivityRange} from './settings.js';
import {TrustedBrowsers} from './trusted.js';

export default class RemotePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const trusted = new TrustedBrowsers(settings);
        const page = new Adw.PreferencesPage({title: 'Remote control', icon_name: 'input-touchpad-symbolic'});
        window.add(page);
        const sensitivity = new Adw.PreferencesGroup({title: 'Pointer sensitivity',
            description: 'The phone slider uses this range in steps of 0.5. Scrolling is unaffected.'});
        page.add(sensitivity);
        const minimum = new Adw.SpinRow({title: 'Minimum', digits: 1,
            adjustment: new Gtk.Adjustment({lower: 0.5, upper: 19.5, step_increment: 0.5, page_increment: 1})});
        const maximum = new Adw.SpinRow({title: 'Maximum', digits: 1,
            adjustment: new Gtk.Adjustment({lower: 1, upper: 20, step_increment: 0.5, page_increment: 1})});
        sensitivity.add(minimum);
        sensitivity.add(maximum);
        let updating = false;
        const syncRange = () => {
            updating = true;
            const range = sensitivityRange(settings);
            minimum.value = range.min;
            maximum.value = range.max;
            updating = false;
        };
        syncRange();
        const saveRange = changed => {
            if (updating)
                return;
            let min = Math.round(minimum.value * 2) / 2;
            let max = Math.round(maximum.value * 2) / 2;
            if (min >= max) {
                if (changed === minimum)
                    max = min + 0.5;
                else
                    min = max - 0.5;
            }
            updating = true;
            settings.delay();
            settings.set_double('sensitivity-min', min);
            settings.set_double('sensitivity-max', max);
            settings.apply();
            updating = false;
            syncRange();
        };
        minimum.connect('notify::value', () => saveRange(minimum));
        maximum.connect('notify::value', () => saveRange(maximum));
        const reset = new Gtk.Button({label: 'Restore defaults', valign: Gtk.Align.CENTER});
        reset.connect('clicked', () => {
            updating = true;
            settings.delay();
            settings.reset('sensitivity-min');
            settings.reset('sensitivity-max');
            settings.apply();
            updating = false;
            syncRange();
        });
        const resetRow = new Adw.ActionRow({title: 'Default range', subtitle: '0.5×–10.0×'});
        resetRow.add_suffix(reset);
        sensitivity.add(resetRow);

        const browsers = new Adw.PreferencesGroup({title: 'Trusted devices',
            description: 'Each entry represents a browser profile, not phone hardware. Trust lasts 90 days. '
                + 'Start the service manually after login or unlocking. Disconnect preserves trust; Forget revokes it.'});
        page.add(browsers);
        let rows = [];
        const renderBrowsers = () => {
            for (const row of rows)
                browsers.remove(row);
            rows = [];
            const add = row => { browsers.add(row); rows.push(row); };
            const records = trusted.list();
            if (!records.length)
                add(new Adw.ActionRow({title: 'No trusted devices',
                    subtitle: 'Choose Remember this browser when approving a new connection on the PC.'}));
            for (const record of records) {
                const entry = new Adw.EntryRow({title: 'Device name', text: record.name, show_apply_button: true});
                entry.connect('apply', () => { trusted.rename(record.id, entry.text); settings.apply(); });
                add(entry);
                const date = value => new Date(value * 1000).toLocaleString();
                const row = new Adw.ActionRow({title: record.expires * 1000 <= Date.now() ? 'Expired' : 'Remembered browser',
                    subtitle: `Approved: ${date(record.created)}\nLast used: ${date(record.lastUsed)}\nExpires: ${date(record.expires)}`});
                const forget = new Gtk.Button({label: 'Forget', valign: Gtk.Align.CENTER, css_classes: ['destructive-action']});
                forget.connect('clicked', () => { trusted.forget(record.id); settings.apply(); });
                row.add_suffix(forget);
                add(row);
            }
            if (records.length) {
                const row = new Adw.ActionRow({title: 'Forget all devices', subtitle: 'Immediately disconnects any remembered browser in use.'});
                const forgetAll = new Gtk.Button({label: 'Forget all', valign: Gtk.Align.CENTER, css_classes: ['destructive-action']});
                forgetAll.connect('clicked', () => { trusted.forgetAll(); settings.apply(); });
                row.add_suffix(forgetAll);
                add(row);
            }
        };
        renderBrowsers();
        const changedId = settings.connect('changed', (_settings, key) => {
            if (key === 'trusted-browsers')
                renderBrowsers();
            else if (!updating)
                syncRange();
        });
        window.connect('close-request', () => { settings.disconnect(changedId); return false; });
    }
}
