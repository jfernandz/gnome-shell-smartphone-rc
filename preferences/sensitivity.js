import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {sensitivityRange} from '../settings.js';
import {SENSITIVITY, snapSensitivity} from '../limits.js';

export function createSensitivityGroup(settings) {
    const sensitivity = new Adw.PreferencesGroup({title: 'Pointer sensitivity',
        description: 'The phone slider uses this range in steps of 0.5. Scrolling is unaffected.'});
    const minimum = new Adw.SpinRow({title: 'Minimum', digits: 1,
        adjustment: new Gtk.Adjustment({lower: SENSITIVITY.min, upper: SENSITIVITY.max - SENSITIVITY.step, step_increment: SENSITIVITY.step, page_increment: 1})});
    const maximum = new Adw.SpinRow({title: 'Maximum', digits: 1,
        adjustment: new Gtk.Adjustment({lower: SENSITIVITY.min + SENSITIVITY.step, upper: SENSITIVITY.max, step_increment: SENSITIVITY.step, page_increment: 1})});
    sensitivity.add(minimum);
    sensitivity.add(maximum);
    let updating = false;
    const syncRange = () => {
        updating = true;
        const range = sensitivityRange(settings);
        minimum.value = range.min;
        maximum.value = range.max;
        updating = false;
    };
    syncRange();
    const applySettings = change => {
        updating = true;
        settings.delay();
        change();
        settings.apply();
        updating = false;
        syncRange();
    };
    const saveRange = changed => {
        if (updating)
            return;
        let min = snapSensitivity(minimum.value);
        let max = snapSensitivity(maximum.value);
        if (min >= max) {
            if (changed === minimum)
                max = min + SENSITIVITY.step;
            else
                min = max - SENSITIVITY.step;
        }
        applySettings(() => {
            settings.set_double('sensitivity-min', min);
            settings.set_double('sensitivity-max', max);
        });
    };
    minimum.connect('notify::value', () => saveRange(minimum));
    maximum.connect('notify::value', () => saveRange(maximum));
    const reset = new Gtk.Button({label: 'Restore defaults', valign: Gtk.Align.CENTER});
    reset.connect('clicked', () => {
        applySettings(() => {
            settings.reset('sensitivity-min');
            settings.reset('sensitivity-max');
        });
    });
    const resetRow = new Adw.ActionRow({title: 'Default range', subtitle: `${SENSITIVITY.defaultMin.toFixed(1)}×–${SENSITIVITY.defaultMax.toFixed(1)}×`});
    resetRow.add_suffix(reset);
    sensitivity.add(resetRow);

    const changedId = settings.connect('changed', (_settings, key) => {
        if (key.startsWith('sensitivity-') && !updating)
            syncRange();
    });
    return {group: sensitivity, destroy: () => settings.disconnect(changedId)};
}
