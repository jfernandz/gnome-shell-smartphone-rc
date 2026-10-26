import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

test('temporary authorization protects credential ownership and preserves recovery/revocation rules', () => {
    const output = execFileSync('gjs', ['-m', 'tests/session-authorization-fixture.js'], {encoding: 'utf8', timeout: 3000});
    assert.match(output, /^PASS: authorization owns/);
});
