import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {TRUST_DURATIONS, trustDurationDays} from '../settings.js';

export function createSecurityGroup(settings) {
    const group = new Adw.PreferencesGroup({title: 'Security',
        description: 'A remembered browser can control your unlocked desktop while the service is running.'});
    const duration = new Adw.ComboRow({title: 'Remember new browsers for',
        subtitle: 'Existing devices keep their expiry. Forget and pair again to change it.',
        model: Gtk.StringList.new(TRUST_DURATIONS.map(days => `${days} days`))});
    duration.selected = TRUST_DURATIONS.indexOf(trustDurationDays(settings));
    duration.connect('notify::selected', () => settings.set_uint('trust-duration-days', TRUST_DURATIONS[duration.selected]));
    group.add(duration);
    group.add(new Adw.ActionRow({title: 'Verify the PC certificate before approval',
        subtitle: 'Compare the SHA-256 fingerprint in the PC dialog with the certificate details in the phone browser. A fingerprint displayed by a web page is not proof.'}));
    const changed = settings.connect('changed::trust-duration-days', () => {
        const selected = TRUST_DURATIONS.indexOf(trustDurationDays(settings));
        if (duration.selected !== selected)
            duration.selected = selected;
    });
    return {group, destroy: () => settings.disconnect(changed)};
}
