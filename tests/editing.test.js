import assert from 'node:assert/strict';
import test from 'node:test';
import {textChange, editMessages} from '../web/editing.js';
import {validateInput} from '../protocol.js';

test('edits preserve correction semantics and count Unicode characters rather than UTF-16 units', () => {
    for (const [before, after] of [['helo', 'hello'], ['a🙂b', 'a🙂c'], ['日本', '日本語'], ['abc', ''], ['word tail', 'Word tail']]) {
        const {remove, text} = textChange(before, after);
        const result = Array.from(before).slice(0, Array.from(before).length - remove).join('') + text;
        assert.equal(result, after);
    }
    assert.deepEqual(textChange('a🙂b', 'a'), {remove: 2, text: ''});

});


test('long edits are bounded without splitting Unicode or duplicating retained text', () => {
    for (const [before, after] of [
        ['', 'a'.repeat(511) + '🙂日本'.repeat(250)],
        ['old '.repeat(400), 'new '.repeat(400)],
        ['x'.repeat(1300), ''],
    ]) {
        let desktop = before;
        const messages = editMessages(before, after, 7);
        for (const message of messages) {
            assert.ok(validateInput(message));
            assert.ok(message.text.length <= 512);
            assert.ok(message.remove <= 512);
            const characters = Array.from(desktop);
            desktop = characters.slice(0, characters.length - message.remove).join('') + message.text;
        }
        assert.equal(desktop, after);
    }
    assert.deepEqual(editMessages('same', 'same', 1), []);
});
