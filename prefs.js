import Adw from 'gi://Adw';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {TrustedBrowsers} from './trusted.js';
import {createSensitivityGroup} from './preferences/sensitivity.js';
import {createNetworkGroup} from './preferences/network.js';
import {createSecurityGroup} from './preferences/security.js';
import {createTrustedGroup} from './preferences/devices.js';
import {createAboutGroup} from './preferences/about.js';
import {createStartupGroup} from './preferences/startup.js';
import {createAutoStopGroup} from './preferences/auto-stop.js';

export default class RemotePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const sizeForMonitor = () => {
            const display = window.get_display();
            const surface = window.get_surface();
            const monitor = (surface && display.get_monitor_at_surface(surface)) ?? display.get_monitors().get_item(0);
            const geometry = monitor?.get_geometry();
            window.set_default_size(
                geometry ? Math.min(860, Math.floor(geometry.width * 0.9)) : 860,
                geometry ? Math.min(1000, Math.floor(geometry.height * 0.85)) : 800);
        };
        sizeForMonitor();
        const realizeId = window.connect('realize', () => {
            window.disconnect(realizeId);
            sizeForMonitor();
        });
        // Range transactions must not delay trust revocations on the same settings object.
        const sensitivity = createSensitivityGroup(this.getSettings());
        const devices = createTrustedGroup(new TrustedBrowsers(this.getSettings()), window);
        const security = createSecurityGroup(this.getSettings(), () => {
            window.set_visible_page_name('service');
            network.focusAddress();
        });
        const network = createNetworkGroup((config, error) => security.setCertificate(config, error));
        const startup = createStartupGroup(this.getSettings());
        const autoStop = createAutoStopGroup(this.getSettings());
        const about = createAboutGroup(this.dir, this.metadata);
        for (const [name, title, icon, groups] of [
            ['service', 'Service', 'system-run-symbolic', [network.group, startup.group, autoStop.group]],
            ['pointer', 'Pointer', 'input-touchpad-symbolic', [sensitivity.group]],
            ['security', 'Security', 'security-high-symbolic', [security.certificateGroup, security.group]],
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
            startup.destroy();
            devices.destroy();
            return false;
        });
    }
}
