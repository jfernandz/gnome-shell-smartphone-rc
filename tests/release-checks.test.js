import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {readReleaseChecks} from '../scripts/lib/release-checks.mjs';

const commit = 'a'.repeat(40);
function fixture(t) {
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-release-checks-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    for (const major of ['22', '24']) {
        const folder = join(directory, `release-checks-node-${major}`);
        mkdirSync(folder);
        writeFileSync(join(folder, 'evidence.json'), JSON.stringify({commit, node: `${major}.20.0`, checks: {lint: true, automatedTests: true}}));
        for (const name of ['lint.txt', 'automated-tests.txt']) writeFileSync(join(folder, name), 'Fixture check log\n');
    }
    return directory;
}

test('release receipts require successful lint/tests on both Node versions for the exact commit', t => {
    const directory = fixture(t);
    assert.deepEqual(readReleaseChecks(directory, commit).map(item => item.major), ['22', '24']);
    assert.throws(() => readReleaseChecks(directory, 'b'.repeat(40)), /Invalid or stale/);
});

test('release preparation rejects incomplete, wrong-version or unsuccessful CI evidence', t => {
    for (const change of [data => delete data.node, data => data.node = '26.0.0', data => data.checks.lint = false,
        data => data.checks.automatedTests = false, data => delete data.checks.lint]) {
        const directory = fixture(t);
        const file = join(directory, 'release-checks-node-24/evidence.json');
        const data = JSON.parse(readFileSync(file, 'utf8'));
        change(data);
        writeFileSync(file, JSON.stringify(data));
        assert.throws(() => readReleaseChecks(directory, commit), /Invalid or stale/);
    }
    const directory = fixture(t);
    rmSync(join(directory, 'release-checks-node-22'), {recursive: true});
    assert.throws(() => readReleaseChecks(directory, commit), /ENOENT/);
});

test('successful receipts without their check logs cannot replace the test run', t => {
    const directory = fixture(t);
    rmSync(join(directory, 'release-checks-node-24/automated-tests.txt'));
    assert.throws(() => readReleaseChecks(directory, commit), /ENOENT/);
});
