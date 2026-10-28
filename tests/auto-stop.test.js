import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {AUTO_STOP, autoStopMinutes} from '../settings.js';

const source = readFileSync(new URL('../auto-stop.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/export (class|function)/g, '$1');

function fixture() {
    let now = 100;
    let next = 0;
    let expired = 0;
    const sources = new Map();
    const ticks = [];
    const environment = {
        PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false, SOURCE_CONTINUE: true,
        get_monotonic_time: () => now * 1_000_000,
        timeout_add_seconds(_priority, seconds, callback) {
            assert.equal(seconds, 1);
            const id = ++next;
            sources.set(id, callback);
            return id;
        },
        Source: {remove(id) { assert.ok(sources.delete(id)); }},
    };
    const context = vm.createContext({GLib: environment, AUTO_STOP});
    const {AutoStopTimer, formatRemaining} = vm.runInContext(`(() => {${source}; return {AutoStopTimer, formatRemaining};})()`, context);
    const timer = new AutoStopTimer(() => expired++, remaining => ticks.push(remaining));
    return {timer, ticks, sources, formatRemaining,
        get expired() { return expired; },
        elapse(seconds, deliver = true) {
            now += seconds;
            if (deliver)
                for (const [id, callback] of [...sources])
                    if (!callback()) sources.delete(id);
        },
    };
}

test('automatic stop defaults and duration validation are bounded', () => {
    for (const value of [1, 30, 1440])
        assert.equal(autoStopMinutes({get_uint: () => value}), value);
    for (const value of [0, -1, 1441, 1.5, NaN, Infinity])
        assert.equal(autoStopMinutes({get_uint: () => value}), 30);
    const f = fixture();
    assert.equal(f.timer.remainingSeconds, null);
    assert.equal(f.sources.size, 0);
    for (const value of [0, -1, 1441, 1.5, NaN, Infinity])
        assert.equal(f.timer.start(value), false);
    assert.equal(f.sources.size, 0);
});

test('countdown uses elapsed time and expires once even after a delayed tick', () => {
    const f = fixture();
    assert.equal(f.timer.start(2), true);
    assert.equal(f.ticks.at(-1), 120);
    f.elapse(15);
    assert.equal(f.ticks.at(-1), 105);
    f.elapse(120);
    assert.equal(f.expired, 1);
    assert.equal(f.timer.remainingSeconds, null);
    assert.equal(f.sources.size, 0);
    f.elapse(200);
    assert.equal(f.expired, 1);
});

test('extending adds to the deadline; cancelling clears the current timer', () => {
    const f = fixture();
    f.timer.start(30);
    f.elapse(60);
    assert.equal(f.timer.extend(15), true);
    assert.equal(f.timer.remainingSeconds, 44 * 60);
    assert.equal(f.sources.size, 1);
    f.timer.cancel();
    assert.equal(f.timer.remainingSeconds, null);
    assert.equal(f.sources.size, 0);
    assert.equal(f.ticks.at(-1), null);
    assert.equal(f.timer.extend(15), false);
    f.elapse(5000);
    assert.equal(f.expired, 0);
});

test('an expired deadline cannot be revived by extending before its scheduled callback', () => {
    const f = fixture();
    f.timer.start(1);
    f.elapse(61, false);
    assert.equal(f.timer.extend(15), false);
    assert.equal(f.expired, 1);
    assert.equal(f.sources.size, 0);
    f.elapse(5);
    assert.equal(f.expired, 1);
});

test('extension limits preserve the live deadline and allow a full extra fifteen minutes later', () => {
    const f = fixture();
    f.timer.start(1440);
    for (const value of [15, 0, -1, NaN, 1.5, Infinity])
        assert.equal(f.timer.extend(value), false);
    assert.equal(f.timer.remainingSeconds, 24 * 60 * 60);
    f.elapse(15 * 60);
    assert.equal(f.timer.extend(15), true);
    assert.equal(f.timer.remainingSeconds, 24 * 60 * 60);
    assert.equal(f.sources.size, 1);
});

test('callbacks from an earlier run cannot stop a new run or survive destruction', () => {
    const f = fixture();
    f.timer.start(1);
    const stale = [...f.sources.values()][0];
    f.timer.cancel();
    f.timer.start(30);
    f.elapse(100, false);
    assert.equal(stale(), false);
    assert.equal(f.timer.remainingSeconds, 1700);
    assert.equal(f.expired, 0);
    const active = [...f.sources.values()][0];
    f.timer.destroy();
    assert.equal(active(), false);
    assert.equal(f.sources.size, 0);
    assert.equal(f.expired, 0);
});

test('remaining-time labels round up and format hours without wrapping at 24 hours', () => {
    const {formatRemaining} = fixture();
    for (const [seconds, label] of [[0, '00:00'], [0.2, '00:01'], [59.2, '01:00'], [3599, '59:59'], [3600, '1:00:00'], [86400, '24:00:00']])
        assert.equal(formatRemaining(seconds), label);
});
