import assert from 'node:assert/strict';
import test from 'node:test';
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';

const uuid = 'smartphone-rc@jfaparicio.github.io';
const source = fs.readFileSync('scripts/install-zip.js', 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/let sourcePath =[\s\S]*?get_uri\(\)\);/, '')
    .replace('export async function', 'async function');

for (const scenario of ['active', 'disabled', 'first', 'snapshot', 'cancel', 'cancel-install', 'source']) {
    test(`ZIP installer behavior: ${scenario}`, async t => {
        const root = fs.mkdtempSync(join(tmpdir(), 'zip-test-'));
        t.after(() => fs.rmSync(root, {recursive: true, force: true}));
        const installed = `${root}/gnome-shell/extensions/${uuid}`;
        const archive = join(root, 'input.zip');
        fs.writeFileSync(archive, 'original');
        const hadInstallation = !['first', 'snapshot', 'source'].includes(scenario);
        if (hadInstallation) { fs.mkdirSync(installed, {recursive: true}); fs.writeFileSync(`${installed}/marker`, 'old'); }
        const enabled = ['active', 'source'].includes(scenario);
        const settings = {'enabled-extensions': enabled ? [uuid, 'other'] : ['other'], 'disabled-extensions': scenario === 'disabled' ? [uuid] : []};
        const originalSettings = structuredClone(settings);
        let extension = hadInstallation || scenario === 'source' ? {dir: file(installed), type: 2} : null;
        let snapshot;
        function file(path) {
            return {get_path: () => path, get_parent: () => file(dirname(path)),
                query_exists: () => fs.existsSync(path), query_file_type: () => 1,
                make_symbolic_link: target => fs.symlinkSync(target, path),
                set_attribute_uint32: (_key, mode) => fs.chmodSync(path, mode),
                copy_async: (destination, _flags, _priority, _cancel, _progress, callback) => {
                    fs.copyFileSync(path, destination.get_path()); callback({copy_finish() {}}, {});
                }, delete: () => fs.unlinkSync(path)};
        }
        const manager = {lookup: () => extension, _enabledExtensions: enabled ? [uuid] : [], _unloadedExtensions: new Set(),
            unloadExtension: async () => { extension = null; },
            createExtensionObject: (_uuid, dir) => (extension = {dir, metadata: {version: 1}, state: 1}),
            enableExtension: () => { settings['enabled-extensions'] = [uuid, 'other']; settings['disabled-extensions'] = []; },
            disableExtension: () => { settings['enabled-extensions'] = ['other']; settings['disabled-extensions'] = [uuid]; },
            loadExtension: async object => { if (scenario !== 'snapshot' && object.dir.get_path().includes('/installed/')) throw Error('broken import'); }};
        const runCommand = async (argv, options) => {
            assert.equal(options.timeoutMs, 30000);
            if (argv[0] === 'unzip') {
                snapshot ??= argv[2];
                assert.equal(argv[2], snapshot);
                assert.notEqual(snapshot, archive);
                assert.equal(fs.readFileSync(snapshot, 'utf8'), 'original');
                assert.equal(fs.statSync(snapshot).mode & 0o777, 0o600);
                fs.writeFileSync(archive, 'replacement');
                if (scenario === 'cancel') throw Error('cancelled');
                return argv[3] === 'metadata.json' ? JSON.stringify({uuid}) : 'entry';
            }
            if (argv[0] === 'cp') fs.cpSync(argv[3], argv[4], {recursive: true});
            if (argv[0] === 'mv') fs.renameSync(argv[2], argv[3]);
            if (argv[0] === 'gnome-extensions') {
                assert.equal(argv.at(-1), snapshot);
                assert.equal(fs.readFileSync(snapshot, 'utf8'), 'original');
                fs.mkdirSync(installed, {recursive: true});
                fs.writeFileSync(`${installed}/marker`, 'new');
                if (scenario === 'cancel-install') throw Error('cancelled install');
                return uuid;
            }
            return '';
        };
        const GLib = {get_user_cache_dir: () => root, get_user_data_dir: () => root,
            path_is_absolute: path => path.startsWith('/'), mkdir_with_parents: path => fs.mkdirSync(path, {recursive: true}),
            mkdtemp: template => fs.mkdtempSync(template.replace('XXXXXX', ''))};
        const Gio = {File: {new_for_path: file}, FileCopyFlags: {NONE: 0}, FileQueryInfoFlags: {NONE: 0, NOFOLLOW_SYMLINKS: 1}, FileType: {DIRECTORY: 1}};
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const install = await new AsyncFunction('Gio', 'GLib', 'Main', 'ExtensionState', 'ExtensionType', 'runCommand', 'global', `${source}\nreturn installZip;`)(
            Gio, GLib, {extensionManager: manager}, {ACTIVE: 1}, {PER_USER: 2}, runCommand,
            {settings: {get_strv: key => [...settings[key]], set_strv: (key, value) => { settings[key] = value; }}});
        if (scenario === 'snapshot') {
            assert.match(await install(archive), /Installed and loaded/);
            assert.equal(fs.existsSync(snapshot), false);
            return;
        }
        await assert.rejects(install(archive), scenario === 'cancel' ? /cancelled/ : /Previous installation restored/);
        assert.deepEqual(settings, originalSettings);
        assert.equal(fs.existsSync(installed), hadInstallation);
        if (hadInstallation) assert.equal(fs.readFileSync(`${installed}/marker`, 'utf8'), 'old');
        assert.equal(fs.existsSync(snapshot), false);
    });
}
