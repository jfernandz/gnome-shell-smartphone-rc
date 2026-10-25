import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
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
        const about = new Adw.PreferencesGroup({title: 'About', description: this.metadata.name});
        about.add(new Adw.ActionRow({title: 'Version',
            subtitle: this.metadata['version-name'] ?? String(this.metadata.version ?? 'Unknown')}));
        about.add(new Adw.ActionRow({title: 'License', subtitle: 'GPL-3.0-or-later'}));
        if (this.metadata.url) {
            const repository = new Adw.ActionRow({title: 'Repository'});
            const link = new Gtk.LinkButton({label: 'Source code', uri: this.metadata.url,
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
