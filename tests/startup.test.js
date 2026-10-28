import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../extension.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export default class', 'class');

function fixture(options = {}) {
    const sources = new Map();
    const mode = {isLocked: false};
    const settings = {'start-after-login': false, 'restart-after-unlock': false, ...options};
    let id = 0;
    const context = vm.createContext({Extension: class {}, Main: {sessionMode: mode}, GLib: {
        PRIORITY_DEFAULT_IDLE: 200, SOURCE_REMOVE: false,
        idle_add(_priority, callback) { sources.set(++id, callback); return id; },
        Source: {remove(key) { assert.ok(sources.delete(key)); }},
        unlink() {}, get_user_runtime_dir: () => '/unused',
    }});
    const ExtensionClass = vm.runInContext(`${source}; SmartphoneRemoteControl`, context);
    const extension = new ExtensionClass();
    extension._settings = {get_boolean: key => settings[key]};
    const starts = [];
    extension._start = pairing => starts.push(pairing);
    // Real _stop(), with inert owned UI/resources.
    extension._sessionActions = {cancel() {}};
    extension._autoStopTimer = {cancel() {}};
    extension._dialogs = {destroy() {}};
    for (const key of ['_address', '_copy', '_pairing', '_showCertificate', '_approve', '_remember', '_startAction', '_stopAction', '_disconnectAction'])
        extension[key] = {label: {}};
    extension._status = {label: {}};
    return {extension, mode, settings, starts, sources, flush() {
        for (const [key, callback] of [...sources]) {
            sources.delete(key);
            callback();
        }
    }};
}

test('automatic startup defaults off; opt-in runs once without opening pairing', () => {
    const off = fixture();
    off.extension._queueAutomaticStart();
    off.flush();
    assert.deepEqual(off.starts, []);
    const f = fixture({'start-after-login': true});
    f.extension._queueAutomaticStart();
    f.flush();
    assert.deepEqual(f.starts, [false]);
    f.extension._queueAutomaticStart(); // ordinary disable/re-enable is not login
    f.flush();
    assert.equal(f.starts.length, 1);
});

test('unlock restart requires its own option and a service active before lock', () => {
    for (const enabled of [false, true]) {
        for (const running of [false, true]) {
            const f = fixture({'restart-after-unlock': enabled});
            f.extension._queueAutomaticStart();
            f.extension._server = running ? {stop() {}} : null;
            f.mode.isLocked = true;
            f.extension._rememberLock();
            f.extension._stop();
            f.extension._rememberLock(); // disable after the session-mode callback
            f.mode.isLocked = false;
            f.extension._queueAutomaticStart();
            f.flush();
            assert.equal(f.starts.length, enabled && running ? 1 : 0);
        }
    }
});

test('stop cancels deferred startup; changed settings and locked sessions cannot start', () => {
    for (const action of ['stop', 'setting', 'lock']) {
        const f = fixture({'start-after-login': true});
        f.extension._queueAutomaticStart();
        if (action === 'stop') f.extension._stop();
        if (action === 'setting') f.settings['start-after-login'] = false;
        if (action === 'lock') f.mode.isLocked = true;
        f.flush();
        assert.deepEqual(f.starts, []);
        assert.equal(f.sources.size, 0);
    }
});

test('stopped or remotely locked sessions stay off despite unlock opt-in', () => {
    const f = fixture({'start-after-login': true, 'restart-after-unlock': true});
    f.extension._queueAutomaticStart();
    f.flush();
    f.extension._server = {stop() {}};
    f.extension._stop(); // manual stop, automatic expiry or confirmed remote action
    f.mode.isLocked = true;
    f.extension._rememberLock();
    f.mode.isLocked = false;
    f.extension._queueAutomaticStart();
    f.flush();
    assert.equal(f.starts.length, 1);
});
