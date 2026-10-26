import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {TrustedBrowsers} from './trusted.js';
import {createSensitivityGroup} from './preferences/sensitivity.js';
import {createNetworkGroup} from './preferences/network.js';
import {createSecurityGroup} from './preferences/security.js';
import {createTrustedGroup} from './preferences/devices.js';

export default class RemotePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(760, 680);
        // Range transactions must not delay trust revocations on the same settings object.
        const sensitivity = createSensitivityGroup(this.getSettings());
        const devices = createTrustedGroup(new TrustedBrowsers(this.getSettings()), window);
        const security = createSecurityGroup(this.getSettings(), () => {
            window.set_visible_page_name('network');
            network.focusAddress();
        });
        const network = createNetworkGroup((config, error) => security.setCertificate(config, error));
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
            const link = new Gtk.LinkButton({uri: installed.url, valign: Gtk.Align.CENTER,
                tooltip_text: 'View repository on GitHub'});
            const content = new Gtk.Box({spacing: 6});
            content.append(new Gtk.Image({
                gicon: new Gio.FileIcon({file: this.dir.get_child('icons/github-symbolic.svg')}),
                pixel_size: 16,
            }));
            content.append(new Gtk.Label({label: 'Source code'}));
            link.set_child(content);
            link.update_property([Gtk.AccessibleProperty.LABEL], ['Source code on GitHub']);
            repository.add_suffix(link);
            repository.activatable_widget = link;
            about.add(repository);
        }
        for (const [name, title, icon, group] of [
            ['network', 'Network', 'network-workgroup-symbolic', network.group],
            ['pointer', 'Pointer', 'input-touchpad-symbolic', sensitivity.group],
            ['security', 'Security', 'security-high-symbolic', security.group],
            ['devices', 'Devices', 'phone-symbolic', devices.group],
            ['about', 'About', 'help-about-symbolic', about],
        ]) {
            const page = new Adw.PreferencesPage({name, title, icon_name: icon});
            if (name === 'security')
                page.add(security.certificateGroup);
            page.add(group);
            window.add(page);
        }
        window.connect('close-request', () => {
            network.destroy();
            sensitivity.destroy();
            security.destroy();
            devices.destroy();
            return false;
        });
    }
}
