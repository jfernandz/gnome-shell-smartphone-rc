import Adw from 'gi://Adw';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {TrustedBrowsers} from './trusted.js';
import {createSensitivityGroup} from './preferences/sensitivity.js';
import {createNetworkGroup} from './preferences/network.js';
import {createSecurityGroup} from './preferences/security.js';
import {createTrustedGroup} from './preferences/devices.js';
import {createAboutGroup} from './preferences/about.js';
import {createAutoStopGroup} from './preferences/auto-stop.js';

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
        const autoStop = createAutoStopGroup(this.getSettings());
        const about = createAboutGroup(this.dir, this.metadata);
        for (const [name, title, icon, groups] of [
            ['network', 'Network', 'network-workgroup-symbolic', [network.group]],
            ['pointer', 'Pointer', 'input-touchpad-symbolic', [sensitivity.group]],
            ['security', 'Security', 'security-high-symbolic', [security.certificateGroup, security.group, autoStop.group]],
            ['devices', 'Devices', 'phone-symbolic', [devices.group]],
            ['about', 'About', 'help-about-symbolic', [about]],
        ]) {
            const page = new Adw.PreferencesPage({name, title, icon_name: icon});
            for (const group of groups)
                page.add(group);
            window.add(page);
        }
        window.connect('close-request', () => {
            network.destroy();
            sensitivity.destroy();
            security.destroy();
            autoStop.destroy();
            devices.destroy();
            return false;
        });
    }
}
