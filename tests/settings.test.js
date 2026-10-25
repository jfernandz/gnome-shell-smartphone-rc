import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {trustDurationDays, sensitivityRange} from '../settings.js';

test('validates sensitivity range and rejects unsupported external settings', () => {
    const range = (min, max) => sensitivityRange({get_double: key => key === 'sensitivity-min' ? min : max});
    assert.deepEqual(range(2.5, 20), {min: 2.5, max: 20});
    for (const [min, max] of [[0, 5], [2, 2], [5, 2], [1, 21], [0.75, 5], [1, NaN]])
        assert.deepEqual(range(min, max), {min: 0.5, max: 10});
});

test('trusted-browser store validates verifiers, expiry, persistence and revocation in GJS', () => {
    assert.match(execFileSync('gjs', ['-m', 'tests/trusted-fixture.js'], {encoding: 'utf8'}), /passed/);
});


test('trust lifetime accepts supported durations and falls back for invalid settings', () => {
    for (const days of [7, 30, 90])
        assert.equal(trustDurationDays({get_uint: () => days}), days);
    for (const days of [0, 14, 365])
        assert.equal(trustDurationDays({get_uint: () => days}), 7);
});
