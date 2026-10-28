import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

function fixture(t) {
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-prepare-env-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    mkdirSync(join(directory, 'scripts'));
    copyFileSync(new URL('../scripts/prepare-env.sh', import.meta.url), join(directory, 'scripts/prepare-env.sh'));
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    for (const name of ['bash', 'dirname', 'cat'])
        symlinkSync(spawnSync('/bin/sh', ['-c', `command -v ${name}`], {encoding: 'utf8'}).stdout.trim(), join(bin, name));
    symlinkSync(process.execPath, join(bin, 'node'));
    const log = join(directory, 'calls.txt');
    const commands = ['git', 'npm', 'actionlint', 'install', 'cp', 'mv', 'rm', 'mkdir', 'mktemp', 'tar', 'unzip',
        'gnome-shell', 'gjs', 'glib-compile-schemas', 'openssl', 'ip', 'prlimit', 'chromium', 'fc-match', 'fc-list',
        'magick', 'gh', 'python3', 'dbus-run-session', 'gdbus', 'gsettings', 'fusermount3', 'which', 'pacman', 'sudo'];
    for (const name of commands) {
        writeFileSync(join(bin, name), `#!/bin/bash
printf '%s' "\${0##*/}" >> "$FIXTURE_CALLS"
printf ' %s' "$@" >> "$FIXTURE_CALLS"
printf '\\n' >> "$FIXTURE_CALLS"
case "\${0##*/}" in
    sudo) exec "$@" ;;
    gnome-shell) printf 'GNOME Shell 51.1\\n' ;;
    fc-match) printf '%s' "\${FIXTURE_FONT:-Noto Sans}" ;;
    npm) [[ "\${1:-}" != "\${FIXTURE_NPM_FAIL:-never}" ]] || exit 1 ;;
esac
`, {mode: 0o755});
    }
    return {
        bin,
        run(args = [], extra = {}) {
            return spawnSync('/bin/bash', ['scripts/prepare-env.sh', ...args], {cwd: directory, encoding: 'utf8',
                env: {...process.env, PATH: bin, FIXTURE_CALLS: log, ...extra}});
        },
        calls() { try { return readFileSync(log, 'utf8'); } catch { return ''; } },
    };
}

test('default environment check reports missing tools without installing anything', t => {
    const environment = fixture(t);
    rmSync(join(environment.bin, 'actionlint'));
    const result = environment.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MISSING: actionlint/);
    assert.doesNotMatch(environment.calls(), /pacman|sudo|npm ci/);
});

test('complete publication environment is checked without package installation or authentication', t => {
    const environment = fixture(t);
    const result = environment.run(['--check', '--publication']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Development environment ready/);
    assert.match(environment.calls(), /npm ls --depth=0/);
    assert.doesNotMatch(environment.calls(), /pacman|sudo|npm ci|gh auth/);
});

test('explicit install uses pacman and npm for the selected profiles only', t => {
    const environment = fixture(t);
    const result = environment.run(['--install', '--publication']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(environment.calls(), /pacman -S --needed .*actionlint.*chromium.*imagemagick.*github-cli.*python/);
    assert.match(environment.calls(), /npm ci --ignore-scripts/);
    assert.doesNotMatch(environment.calls(), /python-pip|fusermount3|gh auth/);
});

test('conflicting modes and unknown options fail before installation', t => {
    for (const args of [['--install', '--check'], ['--install', '--typo']]) {
        const environment = fixture(t);
        assert.equal(environment.run(args).status, 2);
        assert.equal(environment.calls(), '');
    }
});

test('browser checks detect fallback fonts instead of accepting a missing Noto installation', t => {
    const environment = fixture(t);
    const result = environment.run(['--browser'], {FIXTURE_FONT: 'Verdana'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing Noto Sans/);
    assert.doesNotMatch(environment.calls(), /pacman|npm ci/);
});

test('missing npm dependencies fail the read-only check without repairing them implicitly', t => {
    const environment = fixture(t);
    assert.equal(environment.run(['--check'], {FIXTURE_NPM_FAIL: 'ls'}).status, 1);
    assert.doesNotMatch(environment.calls(), /pacman|npm ci/);
});
