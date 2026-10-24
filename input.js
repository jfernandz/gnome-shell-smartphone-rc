import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class RemoteInput {
    constructor() {
        const seat = global.stage.context.get_backend().get_default_seat();
        this._pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        this._keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    }

    handle(input) {
        const time = GLib.get_monotonic_time();
        switch (input.type) {
        case 'move':
            this._pointer.notify_relative_motion(time, input.dx, input.dy);
            break;
        case 'scroll':
            this._pointer.notify_scroll_continuous(time, input.dx, input.dy, Clutter.ScrollSource.FINGER, Clutter.ScrollFinishFlags.NONE);
            this._pointer.notify_scroll_continuous(time, 0, 0, Clutter.ScrollSource.FINGER, Clutter.ScrollFinishFlags.HORIZONTAL | Clutter.ScrollFinishFlags.VERTICAL);
            break;
        case 'click':
            this._pointer.notify_button(time, input.button, Clutter.ButtonState.PRESSED);
            this._pointer.notify_button(time, input.button, Clutter.ButtonState.RELEASED);
            break;
        case 'key':
            this._key(Clutter.KEY_Return);
            break;
        case 'edit':
            if (Main.inputMethod.currentFocus) {
                if (input.remove)
                    Main.inputMethod.delete_surrounding(-input.remove, input.remove);
                if (input.text)
                    Main.inputMethod.commit(input.text);
            } else {
                // Keep deletion and insertion ordered on the same virtual device.
                for (let i = 0; i < input.remove; i++)
                    this._key(Clutter.KEY_BackSpace);
                this._typeKeys(input.text);
            }
            break;
        }
    }

    _typeKeys(text) {
        for (const character of text) {
            const codepoint = character.codePointAt(0);
            this._key(codepoint <= 0xff ? codepoint : 0x01000000 | codepoint);
        }
    }

    _key(keyval) {
        const time = GLib.get_monotonic_time();
        this._keyboard.notify_keyval(time, keyval, Clutter.KeyState.PRESSED);
        this._keyboard.notify_keyval(time, keyval, Clutter.KeyState.RELEASED);
    }

    destroy() {
        // Each event is an atomic press/release; no key or button remains held.
        this._pointer = null;
        this._keyboard = null;
    }
}
