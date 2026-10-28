import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {TRUST_DURATIONS, trustDurationDays} from '../settings.js';

export function createSecurityGroup(settings, onRenew = null) {
    const certificateGroup = new Adw.PreferencesGroup({title: 'PC certificate',
        description: 'Configure or renew the certificate in Service → Network. New certificates are valid for 90 days.'});
    const fingerprint = new Adw.ActionRow({title: 'Certificate SHA-256', subtitle: 'Not available', subtitle_selectable: true});
    const expiry = new Adw.ActionRow({title: 'Certificate expires', subtitle: 'Not available'});
    const certificateStatus = new Adw.ActionRow({title: 'Certificate status', subtitle: 'Loading…'});
    const renew = new Adw.ButtonRow({title: 'Renew certificate…',
        start_icon_name: 'view-refresh-symbolic', end_icon_name: 'go-next-symbolic',
        tooltip_text: 'Open Service → Network to review the address before applying a new certificate',
        sensitive: Boolean(onRenew)});
    renew.connect('activated', () => onRenew?.());
    for (const row of [certificateStatus, fingerprint, expiry, renew]) certificateGroup.add(row);
    certificateGroup.add(new Adw.ActionRow({title: 'Verify the PC certificate before approval',
        subtitle: 'Compare the SHA-256 fingerprint in the PC dialog with the certificate details in the phone browser. A fingerprint displayed by a web page is not proof. Verify again after renewing the certificate.'}));
    const group = new Adw.PreferencesGroup({title: 'Browser trust',
        description: 'A remembered browser can control your unlocked desktop while the service is running.'});
    const duration = new Adw.ComboRow({title: 'Remember new browsers for',
        subtitle: 'Existing devices keep their expiry. Forget and pair again to change it.',
        model: Gtk.StringList.new(TRUST_DURATIONS.map(days => `${days} days`))});
    duration.selected = TRUST_DURATIONS.indexOf(trustDurationDays(settings));
    duration.connect('notify::selected', () => settings.set_uint('trust-duration-days', TRUST_DURATIONS[duration.selected]));
    group.add(duration);
    const changed = settings.connect('changed::trust-duration-days', () => {
        const selected = TRUST_DURATIONS.indexOf(trustDurationDays(settings));
        if (duration.selected !== selected)
            duration.selected = selected;
    });
    return {
        group, certificateGroup,
        setCertificate(config, error = null) {
            fingerprint.subtitle = config?.fingerprint ?? 'Not available';
            expiry.subtitle = config?.expires ?? 'Not available';
            certificateStatus.subtitle = config?.fingerprint ? 'Configured' : error ?? 'Not configured. Open Service → Network to configure a certificate.';
        },
        destroy: () => settings.disconnect(changed),
    };
}
