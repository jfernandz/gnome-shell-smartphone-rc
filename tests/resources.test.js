import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../resources.json', import.meta.url)));
const files = new Set([...manifest.runtime, ...Object.values(manifest.web).map(asset => asset.file)]);

test('runtime manifest stages and packages exactly the declared files', t => {
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-manifest-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const artifact = execFileSync('bash', ['scripts/package.sh', directory], {encoding: 'utf8'}).trim();
    const packed = execFileSync('unzip', ['-Z1', artifact], {encoding: 'utf8'})
        .trim().split('\n').filter(path => !path.endsWith('/'));
    assert.deepEqual(new Set(packed), files);
    for (const asset of Object.values(manifest.web))
        assert.ok(readFileSync(new URL(`../${asset.file}`, import.meta.url)).length > 0);
});

test('GSettings schema ranges and defaults agree with the shared sensitivity rules', async t => {
    const {SENSITIVITY} = await import('../limits.js');
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-schema-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    execFileSync('bash', ['scripts/lib/stage.sh', directory]);
    const probe = `
        const Gio = imports.gi.Gio;
        const source = Gio.SettingsSchemaSource.new_from_directory(ARGV[0], Gio.SettingsSchemaSource.get_default(), false);
        const schema = source.lookup('org.gnome.shell.extensions.smartphone-rc', false);
        const values = {};
        for (const key of ['sensitivity-min', 'sensitivity-max']) {
            const setting = schema.get_key(key);
            values[key] = {value: setting.get_default_value().get_double(),
                range: setting.get_range().get_child_value(1).get_variant().deep_unpack()};
        }
        print(JSON.stringify(values));`;
    const values = JSON.parse(execFileSync('gjs', ['-c', probe, join(directory, 'schemas')], {encoding: 'utf8'}));
    assert.deepEqual(values['sensitivity-min'], {value: SENSITIVITY.defaultMin, range: [SENSITIVITY.min, SENSITIVITY.max - SENSITIVITY.step]});
    assert.deepEqual(values['sensitivity-max'], {value: SENSITIVITY.defaultMax, range: [SENSITIVITY.min + SENSITIVITY.step, SENSITIVITY.max]});
});

test('independent GJS processes cannot restore revoked trust by writing stale enrollment snapshots', t => {
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-trust-process-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    execFileSync('bash', ['scripts/lib/stage.sh', directory]);
    const env = {...process.env, GSETTINGS_BACKEND: 'keyfile', GSETTINGS_SCHEMA_DIR: join(directory, 'schemas'),
        XDG_CONFIG_HOME: join(directory, 'config')};
    const run = (...args) => JSON.parse(execFileSync('gjs', ['-m', 'tests/trust-process-fixture.js', ...args], {env, encoding: 'utf8'}));
    const first = run('remember', 'ab'.repeat(32));
    assert.equal(run('forget', first.records[0].id).records.length, 0);
    assert.equal(run('stale-write', first.grants).records.length, 0);
    const second = run('remember', 'cd'.repeat(32));
    assert.equal(second.records.length, 1);
    assert.equal(run('forget-all').records.length, 0);
    assert.equal(run('stale-write', second.grants).records.length, 0);
});

test('network application entry points are outside the Shell and preferences import graphs', () => {
    const root = new URL('../', import.meta.url);
    function graph(entry, seen = new Set()) {
        const url = new URL(entry, root);
        if (seen.has(url.href)) return seen;
        seen.add(url.href);
        const source = readFileSync(url, 'utf8');
        for (const [, relative] of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
            if (relative.startsWith('.')) graph(new URL(relative, url).href, seen);
        }
        return seen;
    }
    for (const entry of ['extension.js', 'prefs.js'])
        assert.equal([...graph(entry)].some(url => url.startsWith(new URL('app/', root).href)), false, entry);
    for (const url of graph('app/service-worker.js'))
        assert.doesNotMatch(readFileSync(new URL(url), 'utf8'), /from ['"](?:resource:\/\/\/org\/gnome\/shell\/|gi:\/\/(?:St|Meta|Clutter|Gtk|Adw)(?:['"?]))/);
    assert.ok(manifest.runtime.includes('app/service-worker.js'));
});
