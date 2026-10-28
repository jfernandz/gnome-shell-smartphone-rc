import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {AUTO_STOP, autoStopMinutes} from '../settings.js';

export function createAutoStopGroup(settings) {
    const group = new Adw.PreferencesGroup({title: 'Automatic stop',
        description: 'Limit total service running time, including waiting for a phone. The PC stays on. Changes apply next time you start remote control.'});
    const enabled = new Adw.SwitchRow({title: 'Stop remote control automatically'});
    const duration = new Adw.SpinRow({title: 'Duration (minutes)', digits: 0,
        adjustment: new Gtk.Adjustment({lower: AUTO_STOP.min, upper: AUTO_STOP.max, step_increment: 1, page_increment: 15})});
    group.add(enabled);
    group.add(duration);
    let syncing = false;
    const sync = () => {
        syncing = true;
        enabled.active = settings.get_boolean('auto-stop-enabled');
        duration.value = autoStopMinutes(settings);
        duration.sensitive = enabled.active;
        syncing = false;
    };
    enabled.connect('notify::active', () => {
        if (!syncing)
            settings.set_boolean('auto-stop-enabled', enabled.active);
    });
    duration.connect('notify::value', () => {
        if (!syncing)
            settings.set_uint('auto-stop-minutes', Math.round(duration.value));
    });
    sync();
    const changed = settings.connect('changed', (_settings, key) => {
        if (key === 'auto-stop-enabled' || key === 'auto-stop-minutes')
            sync();
    });
    return {group, destroy: () => settings.disconnect(changed)};
}
