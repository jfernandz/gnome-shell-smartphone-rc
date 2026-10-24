import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class RemoteInput {
    constructor(onFailure = () => {}) {
        this._onFailure = onFailure;
        this._queue = [];
        this._typingPaused = false;
        this._pending = null;
        this._surroundingId = 0;
        this._timeoutId = 0;
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
        case 'edit':
            if (this._typingPaused)
                return;
            if (this._queue.length >= 64) {
                this._fail('Typing paused because keyboard input could not keep up.');
                return;
            }
            this._queue.push(input);
            this._drain();
            break;
        }
    }

    _surroundingState() {
        if (!Main.inputMethod.currentFocus)
            return null;
        const [text, cursor, anchor] = Main.inputMethod.getSurroundingText();
        if (typeof text !== 'string' || !Number.isInteger(cursor) || !Number.isInteger(anchor))
            return null;
        const length = Array.from(text).length;
        if (cursor < 0 || anchor < 0 || cursor > length || anchor > length)
            return null;
        // Only counts are retained locally; no desktop text is sent to the phone.
        return {length, cursor, anchor};
    }

    _drain() {
        if (this._pending || !this._queue.length)
            return;
        const input = this._queue.shift();
        if (input.type === 'key') {
            if (Main.inputMethod.currentFocus)
                this._forwardKey(Clutter.KEY_Return, 36);
            else
                this._key(Clutter.KEY_Return);
            this._drain();
            return;
        }
        const state = this._surroundingState();
        if (!state) {
            // Without text-input acknowledgements, keep all events on one device.
            for (let i = 0; i < input.remove; i++)
                this._key(Clutter.KEY_BackSpace);
            this._typeKeys(input.text);
            this._drain();
            return;
        }
        this._pending = {
            remove: input.remove, text: input.text,
            focus: Main.inputMethod.currentFocus,
            window: global.display.focus_window,
        };
        this._surroundingId = Main.inputMethod.connect('surrounding-text-set', () => this._acknowledge());
        this._advance(state);
    }

    _advance(state) {
        const pending = this._pending;
        if (pending.remove && (state.cursor || state.anchor)) {
            pending.phase = 'delete';
            pending.before = state;
            this._armTimeout();
            this._forwardKey(Clutter.KEY_BackSpace, 22);
        } else if (pending.text) {
            pending.phase = 'insert';
            const added = Array.from(pending.text).length;
            pending.expected = {
                length: state.length - Math.abs(state.cursor - state.anchor) + added,
                cursor: Math.min(state.cursor, state.anchor) + added,
            };
            this._armTimeout();
            Main.inputMethod.commit(pending.text);
        } else {
            this._complete();
        }
    }

    _acknowledge() {
        const pending = this._pending;
        if (!pending)
            return;
        if (pending.focus !== Main.inputMethod.currentFocus || pending.window !== global.display.focus_window) {
            this.cancelKeyboard();
            return;
        }
        const state = this._surroundingState();
        if (!state)
            return;
        if (pending.phase === 'delete') {
            const removed = pending.before.length - state.length;
            if (removed > 0) {
                // A native Backspace may remove a whole Unicode grapheme.
                pending.remove = Math.max(0, pending.remove - removed);
                this._advance(state);
            }
        } else if (state.length === pending.expected.length && state.cursor === pending.expected.cursor && state.anchor === state.cursor) {
            this._complete();
        }
    }

    _armTimeout() {
        if (this._timeoutId)
            GLib.Source.remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._timeoutId = 0;
            this._fail('Typing paused because the text field did not confirm the edit.');
            return GLib.SOURCE_REMOVE;
        });
    }

    _complete() {
        this._clearPending();
        this._drain();
    }

    _clearPending() {
        if (this._surroundingId) {
            Main.inputMethod.disconnect(this._surroundingId);
            this._surroundingId = 0;
        }
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._pending = null;
    }

    cancelKeyboard() {
        this._clearPending();
        this._queue.length = 0;
    }

    resumeKeyboard() {
        this.cancelKeyboard();
        this._typingPaused = false;
    }

    _fail(message) {
        this.cancelKeyboard();
        this._typingPaused = true;
        this._onFailure(message);
    }

    _forwardKey(keyval, keycode) {
        // forward_key expects XKB keycodes (evdev + 8): Backspace=22, Return=36.
        const time = GLib.get_monotonic_time();
        Main.inputMethod.forward_key(keyval, keycode, 0, time, true);
        Main.inputMethod.forward_key(keyval, keycode, 0, time, false);
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
        this.cancelKeyboard();
        // Each event is an atomic press/release; no key or button remains held.
        this._pointer = null;
        this._keyboard = null;
    }
}
