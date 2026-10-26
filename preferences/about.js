import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function createAboutGroup(directory, metadata) {
    // Shell passes cached metadata even when newer preferences files are on disk.
    const [, contents] = GLib.file_get_contents(directory.get_child('metadata.json').get_path());
    const installed = JSON.parse(new TextDecoder().decode(contents));
    const version = metadata => metadata['version-name'] ?? String(metadata.version ?? 'Unknown');
    const about = new Adw.PreferencesGroup({title: 'About', description: installed.name});
    about.add(new Adw.ActionRow({title: 'Installed version', subtitle: version(installed)}));
    if (version(installed) !== version(metadata)) {
        about.add(new Adw.ActionRow({title: 'GNOME session version', subtitle: version(metadata)}));
        about.add(new Adw.ActionRow({title: 'Update pending in this session',
            subtitle: 'GNOME still reports the previous version. Log out and back in when convenient to load the installed update.'}));
    }
    about.add(new Adw.ActionRow({title: 'License', subtitle: 'GPL-3.0-or-later'}));
    if (installed.url) {
        const repository = new Adw.ActionRow({title: 'Repository'});
        const link = new Gtk.LinkButton({uri: installed.url, valign: Gtk.Align.CENTER,
            tooltip_text: 'View repository on GitHub'});
        const content = new Gtk.Box({spacing: 6});
        content.append(new Gtk.Image({
            gicon: new Gio.FileIcon({file: directory.get_child('icons/github-symbolic.svg')}),
            pixel_size: 16,
        }));
        content.append(new Gtk.Label({label: 'Source code'}));
        link.set_child(content);
        link.update_property([Gtk.AccessibleProperty.LABEL], ['Source code on GitHub']);
        repository.add_suffix(link);
        repository.activatable_widget = link;
        about.add(repository);
    }
    return about;
}
