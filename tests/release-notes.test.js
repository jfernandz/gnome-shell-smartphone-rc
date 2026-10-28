import assert from 'node:assert/strict';
import test from 'node:test';
import {releaseNotes} from '../scripts/lib/release-notes.mjs';

const repository = 'https://github.com/example/remote';
const changelog = '# Changelog\n\n## Unreleased\n\n- Future work.\n\n## 0.6.10 — 2026-10-28\n\n- Another release.\n\n## 0.6.1 — 2026-10-28\n\n- Add controls.\n- Fix typing.\n\n## 0.6.0 — 2026-10-27\n\n- Previous release.\n';

test('release body includes the exact version details and a linked commit comparison', () => {
    assert.equal(releaseNotes(changelog, 'v0.6.1', repository, 'v0.6.0'),
        '## 0.6.1 — 2026-10-28\n\n- Add controls.\n- Fix typing.\n\n**Full Changelog**: [v0.6.0...v0.6.1](https://github.com/example/remote/compare/v0.6.0...v0.6.1)\n');
});

test('initial release links to its commit history without inventing a predecessor', () => {
    const notes = releaseNotes(changelog, 'v0.6.0', repository);
    assert.match(notes, /Previous release/);
    assert.match(notes, /https:\/\/github.com\/example\/remote\/commits\/v0.6.0/);
    assert.ok(!notes.includes('/compare/'));
});

test('missing changelog sections and invalid tags or repository URLs fail explicitly', () => {
    assert.throws(() => releaseNotes(changelog, 'v9.0.0', repository), /No changelog section/);
    assert.throws(() => releaseNotes(changelog, 'main', repository), /version tags/);
    assert.throws(() => releaseNotes(changelog, 'v0.6.1', repository, 'main'), /version tags/);
    assert.throws(() => releaseNotes(changelog, 'v0.6.1', 'not a URL'), /repository URL/);
});
