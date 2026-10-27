import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {validateInput} from '../protocol.js';

const source = readFileSync(new URL('../volume.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export class', 'class');

function emitter(properties = {}) {
    let next = 0;
    const handlers = new Map();
    return Object.assign(properties, {
        handlers,
        connect(signal, callback) { const id = ++next; handlers.set(id, {signal, callback}); return id; },
        disconnect(id) { assert.ok(handlers.delete(id)); },
        emit(signal) { for (const handler of [...handlers.values()]) if (handler.signal === signal) handler.callback(); },
    });
}

function fixture() {
    function sink(id, volume = 350) {
        return emitter({volume, is_muted: false, pushes: 0, get_id: () => id,
            set_volume(value) { this.volume = value; this.emit('notify::volume'); return true; },
            push_volume() { this.pushes++; },
            change_is_muted(value) { this.is_muted = value; this.emit('notify::is-muted'); },
        });
    }
    const first = sink(12);
    let current = first;
    const control = emitter({get_default_sink: () => current, get_vol_max_norm: () => 1000});
    const timers = new Map();
    let next = 0;
    const context = vm.createContext({validateInput, GLib: {
        PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false,
        timeout_add(_priority, _delay, callback) { const id = ++next; timers.set(id, callback); return id; },
        Source: {remove(id) { timers.delete(id); }},
    }});
    const RemoteVolume = vm.runInContext(`(() => {${source}; return RemoteVolume;})()`, context);
    const states = [];
    const volume = new RemoteVolume(state => states.push(JSON.parse(JSON.stringify(state))), control);
    const flush = () => { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } };
    return {first, control, volume, states, timers, sink, flush,
        switchTo(stream) { current = stream; control.emit('default-sink-changed'); },
    };
}

test('desktop volume updates coalesce and commands cap volume, preserve mute level and ignore stale outputs', () => {
    const f = fixture();
    f.flush();
    assert.deepEqual(f.states.at(-1), {type: 'volume-state', available: true, output: 12, level: 35, muted: false});
    f.first.volume = 700;
    f.first.emit('notify::volume');
    f.first.change_is_muted(true);
    assert.equal(f.timers.size, 1);
    f.flush();
    assert.equal(f.states.at(-1).level, 70);
    assert.equal(f.states.at(-1).muted, true);
    f.volume.handle({type: 'mute', output: 12, muted: false});
    assert.equal(f.first.volume, 700);
    f.volume.handle({type: 'volume', output: 12, level: 100});
    assert.equal(f.first.volume, 1000);
    f.volume.handle({type: 'volume', output: 12, level: 101});
    assert.equal(f.first.volume, 1000);
    f.volume.handle({type: 'volume', output: 12, level: 0});
    assert.equal(f.first.volume, 0);
    assert.equal(f.first.is_muted, true);
    const second = f.sink(13, 200);
    f.switchTo(second);
    assert.equal(f.first.handlers.size, 0);
    f.volume.handle({type: 'volume', output: 12, level: 90});
    assert.equal(second.volume, 200);
    f.flush();
    assert.equal(f.states.at(-1).output, 13);
    f.volume.destroy();
});

test('missing outputs disable volume; destruction removes timers and mixer listeners without closing the shared mixer', () => {
    const f = fixture();
    f.switchTo(null);
    f.volume.handle({type: 'mute', output: 12, muted: true});
    f.flush();
    assert.deepEqual(f.states.at(-1), {type: 'volume-state', available: false, output: -1, level: 0, muted: false});
    const second = f.sink(14, 1200);
    f.switchTo(second);
    f.flush();
    assert.equal(f.states.at(-1).level, 100);
    f.volume.handle({type: 'mute', output: 14, muted: false});
    assert.equal(second.volume, 1000);
    second.emit('notify::volume');
    f.volume.destroy();
    assert.equal(f.timers.size, 0);
    assert.equal(f.control.handlers.size, 0);
    assert.equal(second.handlers.size, 0);
    const count = f.states.length;
    f.volume.handle({type: 'volume', output: 14, level: 20});
    f.flush();
    assert.equal(f.states.length, count);
    assert.equal(second.volume, 1000);
});
