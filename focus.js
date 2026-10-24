import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as IBusManager from 'resource:///org/gnome/shell/misc/ibusManager.js';

export class TextFocus {
    constructor(onChange) {
        this._onChange = onChange;
        this.context = 0;
        this._ibusFocused = false;
        this._ibus = IBusManager.getIBusManager();
        this._inId = this._ibus.connect('focus-in', () => {
            this._ibusFocused = true;
            this.reset();
        });
        this._outId = this._ibus.connect('focus-out', () => {
            this._ibusFocused = false;
            this.reset();
        });
        this._panelId = Main.inputMethod.connect('input-panel-state', () => this.reset());
        this._purposeId = Main.inputMethod.connect('notify::content-purpose', () => this.refresh());
        this._hintsId = Main.inputMethod.connect('notify::content-hints', () => this.refresh());
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this.refresh();
            return GLib.SOURCE_CONTINUE;
        });
        this.reset();
    }

    refresh(force = false) {
        const focus = Main.inputMethod.currentFocus;
        const actor = global.stage.get_key_focus();
        const shellText = actor instanceof Clutter.Text && actor.editable ? actor : null;
        const window = global.display.focus_window;
        const active = Boolean(focus || shellText || this._ibusFocused);
        const purpose = Main.inputMethod.content_purpose;
        const hints = Main.inputMethod.content_hints;
        const sensitive = purpose === Clutter.InputContentPurpose.PASSWORD ||
            Boolean(hints & (Clutter.InputContentHintFlags.HIDDEN_TEXT | Clutter.InputContentHintFlags.SENSITIVE_DATA));
        if (!force && focus === this._focus && shellText === this._actor && window === this._window &&
            active === this._active && sensitive === this._sensitive)
            return;
        this._focus = focus;
        this._actor = shellText;
        this._window = window;
        this._active = active;
        this._sensitive = sensitive;
        this.context++;
        // Only focus metadata leaves this monitor; field contents are not included.
        this._onChange({type: 'focus', context: this.context, active, sensitive});
    }

    reset() {
        this.refresh(true);
    }

    destroy() {
        GLib.Source.remove(this._timer);
        this._ibus.disconnect(this._inId);
        this._ibus.disconnect(this._outId);
        Main.inputMethod.disconnect(this._panelId);
        Main.inputMethod.disconnect(this._purposeId);
        Main.inputMethod.disconnect(this._hintsId);
    }
}
