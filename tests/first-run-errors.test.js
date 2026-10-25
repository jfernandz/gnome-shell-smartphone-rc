import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('first-run dependency and configuration failures are actionable and preserve working credentials', t => {
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-first-run-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const result = execFileSync('gjs', ['-m', 'tests/first-run-errors-fixture.js', directory], {encoding: 'utf8', timeout: 10000});
    assert.equal(result.trim().split('\n').filter(line => line.startsWith('PASS:')).length, 4);
});
