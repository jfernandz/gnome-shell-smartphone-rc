import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

export function createStartupGroup(settings) {
    const group = new Adw.PreferencesGroup({title: 'Automatic start',
        description: 'Remembered browsers can reconnect while the service is running. New browsers still need desktop approval. Remote control is always stopped on the lock screen.'});
    const rows = [];
    for (const [key, title, subtitle] of [
        ['start-after-login', 'Start after login', 'Starts on the first extension activation in your session, including enabling the extension manually.'],
        ['restart-after-unlock', 'Restart after unlock', 'Only if remote control was running before locking. Manual stop, timer expiry and remote Lock PC or Suspend PC leave it off.'],
    ]) {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
        rows.push(row);
    }
    return {group, destroy() {
        for (const row of rows)
            Gio.Settings.unbind(row, 'active');
    }};
}
