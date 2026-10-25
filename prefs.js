import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {TrustedBrowsers} from './trusted.js';
import {createSensitivityGroup} from './preferences/sensitivity.js';
import {createNetworkGroup} from './preferences/network.js';
import {createSecurityGroup} from './preferences/security.js';
import {createTrustedGroup} from './preferences/devices.js';

export default class RemotePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(760, 820);
        const page = new Adw.PreferencesPage({title: 'Remote control', icon_name: 'input-touchpad-symbolic'});
        window.add(page);
        // Range transactions must not delay trust revocations on the same settings object.
        const sensitivity = createSensitivityGroup(this.getSettings());
        const devices = createTrustedGroup(new TrustedBrowsers(this.getSettings()), window);
        const security = createSecurityGroup(this.getSettings());
        const network = createNetworkGroup();
        page.add(network.group);
        page.add(sensitivity.group);
        page.add(security.group);
        page.add(devices.group);
        // Shell passes cached metadata even when newer preferences files are on disk.
        const [, contents] = GLib.file_get_contents(this.dir.get_child('metadata.json').get_path());
        const installed = JSON.parse(new TextDecoder().decode(contents));
        const version = metadata => metadata['version-name'] ?? String(metadata.version ?? 'Unknown');
        const about = new Adw.PreferencesGroup({title: 'About', description: installed.name});
        about.add(new Adw.ActionRow({title: 'Installed version', subtitle: version(installed)}));
        if (version(installed) !== version(this.metadata)) {
            about.add(new Adw.ActionRow({title: 'GNOME session version', subtitle: version(this.metadata)}));
            about.add(new Adw.ActionRow({title: 'Update pending in this session',
                subtitle: 'GNOME still reports the previous version. Log out and back in when convenient to load the installed update.'}));
        }
        about.add(new Adw.ActionRow({title: 'License', subtitle: 'GPL-3.0-or-later'}));
        if (installed.url) {
            const repository = new Adw.ActionRow({title: 'Repository'});
            const link = new Gtk.LinkButton({label: 'Source code', uri: installed.url,
                valign: Gtk.Align.CENTER});
            repository.add_suffix(link);
            repository.activatable_widget = link;
            about.add(repository);
        }
        page.add(about);
        window.connect('close-request', () => {
            network.destroy();
            sensitivity.destroy();
            security.destroy();
            devices.destroy();
            return false;
        });
    }
}
