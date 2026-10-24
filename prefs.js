import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {sensitivityRange} from './settings.js';
import {TrustedBrowsers} from './trusted.js';

export default class RemotePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(760, 820);
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
                const date = value => new Date(value * 1000).toLocaleString();
                const expired = record.expires * 1000 <= Date.now() ? 'Expired · ' : '';
                const row = new Adw.ActionRow({title: record.name, use_markup: false,
                    subtitle: `${expired}Approved: ${date(record.created)}\nLast used: ${date(record.lastUsed)}\nExpires: ${date(record.expires)}`});
                const rename = new Gtk.Button({icon_name: 'document-edit-symbolic', tooltip_text: 'Rename device',
                    valign: Gtk.Align.CENTER});
                rename.connect('clicked', () => {
                    const name = new Gtk.Entry({text: record.name, max_length: 80, activates_default: true});
                    const dialog = new Adw.AlertDialog({heading: 'Rename device', body: 'Choose a name for this browser profile.',
                        extra_child: name, close_response: 'cancel', default_response: 'save'});
                    dialog.add_response('cancel', 'Cancel');
                    dialog.add_response('save', 'Save');
                    dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);
                    dialog.connect('response', (_dialog, response) => {
                        if (response === 'save') {
                            trusted.rename(record.id, name.text);
                            settings.apply();
                        }
                    });
                    dialog.present(window);
                });
                row.add_suffix(rename);
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
