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
    assert.deepEqual(validateInput({type: 'edit', context: 1, remove: 0, text: 'España 🙂'}), {type: 'edit', context: 1, remove: 0, text: 'España 🙂'});
    assert.deepEqual(validateInput({type: 'key', context: 1, key: 'Enter'}), {type: 'key', context: 1, key: 'Enter'});
});

test('limits bursts and resets the budget after one second', () => {
    const limit = new RateLimit();
    for (let i = 0; i < 240; i++)
        assert.equal(limit.accept(5000), true);
    assert.equal(limit.accept(5999), false);
    assert.equal(limit.accept(6000), true);
});

test('bounds live edits and preserves their focus context', () => {
    assert.deepEqual(validateInput({type: 'edit', context: 5, remove: 2, text: 'á🙂'}), {type: 'edit', context: 5, remove: 2, text: 'á🙂'});
    for (const message of [
        {type: 'edit', context: -1, remove: 0, text: 'x'},
        {type: 'edit', context: 5, remove: 513, text: ''},
        {type: 'edit', context: 5, remove: 0, text: 'x'.repeat(513)},
        {type: 'edit', context: 5, remove: 1, text: '\n'},
        {type: 'key', context: '5', key: 'Enter'},
    ])
        assert.equal(validateInput(message), null);
});

test('rejects retired batch-text and auxiliary-key messages', () => {
    for (const message of [
        {type: 'text', text: 'old batch'},
        {type: 'key', key: 'Enter'},
        ...['Backspace', 'Tab', 'Escape'].map(key => ({type: 'key', key, context: 1})),
    ])
        assert.equal(validateInput(message), null);
});
