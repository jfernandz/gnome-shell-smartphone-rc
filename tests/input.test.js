import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../input.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export class', 'class');

function desktop(initial = '', initialCursor = Array.from(initial).length) {
    let text = initial;
    let cursor = initialCursor;
    let anchor = cursor;
    let clock = 0;
    let nextId = 0;
    const callbacks = new Map();
    const timers = new Map();
    const events = [];
    const failures = [];
    const notify = () => { for (const callback of [...callbacks.values()]) callback(); };
    const inputMethod = {
        currentFocus: {},
        getSurroundingText: () => [text, cursor, anchor],
        connect(_signal, callback) { const id = ++nextId; callbacks.set(id, callback); return id; },
        disconnect(id) { callbacks.delete(id); },
        delete_surrounding() { assert.fail('Unsafe compositor deletion API must never be called'); },
        forward_key(_key, code, _state, _time, press) {
            if (press && code === 22) {
                events.push(() => {
                    const characters = Array.from(text);
                    if (cursor > 0) {
                        characters.splice(cursor - 1, 1);
                        cursor--;
                    }
                    anchor = cursor;
                    text = characters.join('');
                    notify();
                });
            }
        },
        commit(value) {
            events.push(() => {
                const characters = Array.from(text);
                characters.splice(cursor, 0, ...Array.from(value));
                cursor += Array.from(value).length;
                anchor = cursor;
                text = characters.join('');
                notify();
            });
        },
    };
    const device = {notify_keyval() {}, notify_relative_motion() {}, notify_button() {}};
    const context = vm.createContext({
        Main: {inputMethod},
        global: {display: {focus_window: {}}, stage: {context: {get_backend: () => ({get_default_seat: () => ({create_virtual_device: () => device})})}}},
        Clutter: {InputDeviceType: {POINTER_DEVICE: 0, KEYBOARD_DEVICE: 1}, KEY_Return: 0xff0d, KEY_BackSpace: 0xff08, KeyState: {PRESSED: 1, RELEASED: 0}},
        GLib: {
            PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false, get_monotonic_time: () => ++clock,
            timeout_add(_priority, _delay, callback) { const id = ++nextId; timers.set(id, callback); return id; },
            Source: {remove(id) { timers.delete(id); }},
        },
    });
    const RemoteInput = vm.runInContext(`(() => {${source}; return RemoteInput;})()`, context);
    const input = new RemoteInput(message => failures.push(message));
    function deliver() {
        let count = 0;
        while (events.length) {
            assert.ok(++count < 2000, 'Input queue must terminate');
            events.shift()();
        }
    }
    function expire() {
        for (const [id, callback] of [...timers]) {
            timers.delete(id);
            callback();
        }
    }
    return {input, deliver, expire, failures, timers, callbacks, text: () => text};
}

test('deleting beyond the start of a field uses bounded Backspace behavior, never surrounding offsets', () => {
    const target = desktop('existing', 0);
    target.input.handle({type: 'edit', remove: 512, text: 'A'});
    target.deliver();
    assert.equal(target.text(), 'Aexisting');
    assert.equal(target.timers.size, 0);
    assert.equal(target.callbacks.size, 0);
});

test('replacement and subsequent edits wait for application acknowledgements and preserve Unicode', () => {
    const target = desktop('helo España');
    target.input.handle({type: 'edit', remove: 8, text: 'lo España'});
    target.input.handle({type: 'edit', remove: 1, text: ''});
    target.deliver();
    assert.equal(target.text(), 'hello Españ');
    assert.deepEqual(target.failures, []);
});

test('cancelling pending typing discards its replacement and queued edits', () => {
    const target = desktop('abc');
    target.input.handle({type: 'edit', remove: 2, text: 'X'});
    target.input.handle({type: 'edit', remove: 0, text: 'Y'});
    target.input.cancelKeyboard();
    target.deliver();
    assert.equal(target.text(), 'ab');
    assert.equal(target.timers.size, 0);
    assert.equal(target.callbacks.size, 0);
});

test('an unacknowledged edit fails closed and cleans up its timers and signals', () => {
    const target = desktop();
    target.input.handle({type: 'edit', remove: 0, text: 'A'});
    target.expire();
    assert.equal(target.failures.length, 1);
    assert.equal(target.timers.size, 0);
    assert.equal(target.callbacks.size, 0);
    target.input.destroy();
});


test('a timeout pauses edits until explicitly resumed without disabling pointer input', () => {
    const target = desktop();
    target.input.handle({type: 'edit', remove: 0, text: 'A'});
    target.expire();
    target.input.handle({type: 'edit', remove: 0, text: 'discard'});
    target.input.handle({type: 'move', dx: 10, dy: 20});
    target.deliver();
    assert.equal(target.text(), 'A');
    target.input.resumeKeyboard();
    target.input.handle({type: 'edit', remove: 0, text: 'B'});
    target.deliver();
    assert.equal(target.text(), 'AB');
});
