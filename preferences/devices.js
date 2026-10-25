import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

function renameBrowser(trusted, window, record) {
    const name = new Gtk.Entry({text: record.name, max_length: 80, activates_default: true});
    const dialog = new Adw.AlertDialog({heading: 'Rename device', body: 'Choose a name for this browser profile.',
        extra_child: name, close_response: 'cancel', default_response: 'save'});
    dialog.add_response('cancel', 'Cancel');
    dialog.add_response('save', 'Save');
    dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);
    dialog.connect('response', (_dialog, response) => {
        if (response === 'save')
            trusted.rename(record.id, name.text);
    });
    dialog.present(window);
}

function browserRow(trusted, window, initial) {
    let record = initial;
    const row = new Adw.ActionRow({use_markup: false});
    const rename = new Gtk.Button({icon_name: 'document-edit-symbolic', tooltip_text: 'Rename device', valign: Gtk.Align.CENTER});
    rename.connect('clicked', () => renameBrowser(trusted, window, record));
    row.add_suffix(rename);
    const forget = new Gtk.Button({label: 'Forget', valign: Gtk.Align.CENTER, css_classes: ['destructive-action']});
    forget.connect('clicked', () => trusted.forget(record.id));
    row.add_suffix(forget);
    return {
        row,
        update(next) {
            record = next;
            const date = value => new Date(value * 1000).toLocaleString();
            const expired = record.expires * 1000 <= Date.now() ? 'Expired · ' : '';
            row.title = record.name;
            row.subtitle = `${expired}Approved: ${date(record.created)}\nLast used: ${date(record.lastUsed)}\nExpires: ${date(record.expires)}`;
        },
    };
}

export function createTrustedGroup(trusted, window) {
    const group = new Adw.PreferencesGroup({title: 'Trusted devices',
        description: 'Each entry represents a browser profile, not phone hardware. Trust expires on the date shown below. '
            + 'Start the service manually after login or unlocking. Disconnect preserves trust; Forget revokes it.'});
    const empty = new Adw.ActionRow({title: 'No trusted devices',
        subtitle: 'Choose Remember this browser when approving a new connection on the PC.'});
    group.add(empty);
    const forgetAll = new Adw.ActionRow({title: 'Forget all devices', subtitle: 'Immediately disconnects any remembered browser in use.'});
    const button = new Gtk.Button({label: 'Forget all', valign: Gtk.Align.CENTER, css_classes: ['destructive-action']});
    button.connect('clicked', () => trusted.forgetAll());
    forgetAll.add_suffix(button);
    group.add(forgetAll);
    const rows = new Map();
    const refresh = () => {
        const records = trusted.list();
        const ids = new Set(records.map(record => record.id));
        for (const [id, view] of rows) {
            if (!ids.has(id)) {
                group.remove(view.row);
                rows.delete(id);
            }
        }
        let added = false;
        for (const record of records) {
            if (!rows.has(record.id)) {
                const view = browserRow(trusted, window, record);
                rows.set(record.id, view);
                group.add(view.row);
                added = true;
            }
            rows.get(record.id).update(record);
        }
        if (added) {
            group.remove(forgetAll);
            group.add(forgetAll);
        }
        empty.visible = records.length === 0;
        forgetAll.visible = records.length > 0;
    };
    refresh();
    const unwatch = trusted.watch(refresh);
    return {group, destroy: unwatch};
}
