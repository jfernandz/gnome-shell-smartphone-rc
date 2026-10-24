import assert from 'node:assert/strict';
import test from 'node:test';
import {RateLimit, validateInput} from '../protocol.js';

test('rejects malformed and unbounded input', () => {
    for (const value of [null, [], 'move', {}, {type: 'move', dx: Infinity, dy: 0},
        {type: 'move', dx: 501, dy: 0}, {type: 'click', button: 2}, {type: 'key', key: 'Super'},
        {type: 'text', text: 'a'.repeat(129)}, {type: 'text', text: '\n'}, {type: 'text', text: '\ud800'}])
        assert.equal(validateInput(value), null);
});

test('accepts bounded input and Unicode text without forwarding extra properties', () => {
    assert.deepEqual(validateInput({type: 'move', dx: 12.5, dy: -10, command: 'ignored'}), {type: 'move', dx: 12.5, dy: -10});
    assert.deepEqual(validateInput({type: 'text', text: 'España 🙂'}), {type: 'text', text: 'España 🙂'});
    assert.deepEqual(validateInput({type: 'key', key: 'Enter'}), {type: 'key', key: 'Enter'});
});

test('limits bursts and resets the budget after one second', () => {
    const limit = new RateLimit();
    for (let i = 0; i < 240; i++)
        assert.equal(limit.accept(5000), true);
    assert.equal(limit.accept(5999), false);
    assert.equal(limit.accept(6000), true);
});
