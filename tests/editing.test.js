import assert from 'node:assert/strict';
import test from 'node:test';
import {textChange, recentText} from '../web/editing.js';

test('edits preserve correction semantics and count Unicode characters rather than UTF-16 units', () => {
    for (const [before, after] of [['helo', 'hello'], ['a🙂b', 'a🙂c'], ['日本', '日本語'], ['abc', ''], ['word tail', 'Word tail']]) {
        const {remove, text} = textChange(before, after);
        const result = Array.from(before).slice(0, Array.from(before).length - remove).join('') + text;
        assert.equal(result, after);
    }
    assert.deepEqual(textChange('a🙂b', 'a'), {remove: 2, text: ''});
    assert.equal(Array.from(recentText('🙂'.repeat(200))).length, 128);
});
