import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, openSync, closeSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';
import {once} from 'node:events';

// Own the compositor and bus; never accept an address supplied by the desktop.
const archive = resolve(process.argv[2] ?? 'dist/smartphone-rc-0.5.1.zip');
assert.ok(existsSync(archive), 'Pass a built project ZIP');
const root = mkdtempSync(join(homedir(), '.cache/smartphone-rc-native-'));
for (const name of ['data', 'config', 'cache', 'runtime', 'tmp']) mkdirSync(join(root, name), {mode: 0o700});
const driver = join(root, 'data/gnome-shell/extensions/test-driver@smartphone-rc.local');
mkdirSync(driver, {recursive: true});
writeFileSync(join(driver, 'metadata.json'), JSON.stringify({uuid: 'test-driver@smartphone-rc.local', name: 'Isolated test driver',
    description: 'Disposable test compositor only', 'shell-version': ['51']}));
writeFileSync(join(driver, 'extension.js'), `import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
export default class Driver extends Extension {
    enable() { this.previous = global.context.unsafe_mode; global.context.unsafe_mode = true; }
    disable() { global.context.unsafe_mode = this.previous; }
}
`);
const env = {...process.env};
for (const key of ['DISPLAY', 'WAYLAND_DISPLAY', 'DBUS_SESSION_BUS_ADDRESS', 'DBUS_STARTER_ADDRESS', 'DBUS_STARTER_BUS_TYPE',
    'SESSION_MANAGER', 'GNOME_SETUP_DISPLAY', 'GNOME_SHELL_SESSION_MODE', 'GSETTINGS_SCHEMA_DIR']) delete env[key];
Object.assign(env, {XDG_DATA_HOME: join(root, 'data'), XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache'),
    XDG_RUNTIME_DIR: join(root, 'runtime'), TMPDIR: join(root, 'tmp'), GSETTINGS_BACKEND: 'keyfile',
    LIBGL_ALWAYS_SOFTWARE: '1', GVFS_DISABLE_FUSE: '1', GTK_USE_PORTAL: '0', XDG_SESSION_TYPE: 'wayland', XDG_CURRENT_DESKTOP: 'GNOME', SMARTPHONE_RC_NATIVE_ROOT: root});
const log = openSync(join(root, 'shell.log'), 'w');
const session = spawn('dbus-run-session', ['--', 'bash', '-e', '-c', `
gsettings set org.gnome.shell enabled-extensions "['test-driver@smartphone-rc.local']"
gsettings set org.gnome.shell disable-user-extensions false
printf '%s' "$DBUS_SESSION_BUS_ADDRESS" > "$SMARTPHONE_RC_NATIVE_ROOT/bus"
exec gnome-shell --headless --wayland --no-x11 --virtual-monitor 1280x900 --wayland-display smartphone-rc-test
`], {env, detached: true, stdio: ['ignore', log, log]});
closeSync(log);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let passed = false;
function run(command, args, extra = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {env: {...env, ...extra}, stdio: 'inherit'});
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error(`${command} timed out`)); }, 90000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(Error(`${command} exited with ${code}`)); });
    });
}
try {
    console.log(`Isolated native profile: ${root}`);
    const probe = join(root, 'probe.json');
    for (let attempt = 0; attempt < 160; attempt++) {
        assert.ok(session.exitCode === null && session.signalCode === null, `Compositor exited; inspect ${root}/shell.log`);
        if (existsSync(join(root, 'bus'))) {
            const code = `GLib.file_set_contents(${JSON.stringify(probe)},JSON.stringify({data:GLib.get_user_data_dir(),runtime:GLib.get_user_runtime_dir(),driver:Main.extensionManager.lookup('test-driver@smartphone-rc.local')?.state}));true;`;
            try {
                execFileSync('gdbus', ['call', '--address', readFileSync(join(root, 'bus'), 'utf8'), '--dest', 'org.gnome.Shell',
                    '--object-path', '/org/gnome/Shell', '--method', 'org.gnome.Shell.Eval', code], {timeout: 1500, stdio: 'ignore'});
                if (existsSync(probe) && JSON.parse(readFileSync(probe)).driver === 1) break;
            } catch { /* Wait for this compositor's own evaluation driver. */ }
        }
        await delay(250);
    }
    const identity = JSON.parse(readFileSync(probe));
    assert.deepEqual(identity, {data: join(root, 'data'), runtime: join(root, 'runtime'), driver: 1});
    const nativeEnv = {SMARTPHONE_RC_ISOLATED_SHELL: '1'};
    await run('node', ['tests/install-zip-native.mjs', join(root, 'bus'), archive], nativeEnv);
    await run('node', ['tests/shell-security-native.mjs', join(root, 'bus'), join(root, 'runtime')], nativeEnv);
    const guiEnv = {DBUS_SESSION_BUS_ADDRESS: readFileSync(join(root, 'bus'), 'utf8'), WAYLAND_DISPLAY: 'smartphone-rc-test',
        GSETTINGS_BACKEND: 'memory', GTK_A11Y: 'none'};
    const output = resolve('dist/publication');
    mkdirSync(output, {recursive: true});
    for (const [scheme, font, label] of [['light', 'Sans 11', 'light'], ['dark', 'Sans 11', 'dark'],
        ['dark', 'Sans 22', 'dark-large-text']]) {
        await run('gjs', ['-m', 'tests/preferences-native.mjs', join(root, 'data/gnome-shell/extensions/smartphone-rc@jfaparicio.github.io')],
            {...guiEnv, SMARTPHONE_RC_TEST_COLOR_SCHEME: scheme, SMARTPHONE_RC_TEST_FONT: font,
                SMARTPHONE_RC_TEST_SCREENSHOT: join(output, `preferences-${label}.png`)});
    }
    for (const name of ['network-preferences', 'network-errors']) {
        const config = join(root, `${name}-config`); mkdirSync(config, {mode: 0o700});
        await run('gjs', ['-m', `tests/${name}-native.mjs`], {...guiEnv, XDG_CONFIG_HOME: config, SMARTPHONE_RC_NETWORK_TEST: '1'});
    }
    passed = true;
    console.log('PASS: isolated ZIP, Shell lifecycle and native preferences checks');
} finally {
    // Signal only the new process group owned by this launcher.
    try { process.kill(-session.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    if (session.exitCode === null && session.signalCode === null)
        await Promise.race([once(session, 'exit'), delay(3000)]);
    try { process.kill(-session.pid, 'SIGKILL'); } catch { /* Group already gone. */ }
    // Unmount only FUSE mounts created beneath this disposable profile.
    for (const line of readFileSync('/proc/self/mountinfo', 'utf8').split('\n')) {
        const fields = line.split(' ');
        const path = fields[4]?.replace(/\\([0-7]{3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)));
        if (path?.startsWith(`${root}/`) && line.includes(' - fuse.')) {
            try { execFileSync('fusermount3', ['-uz', path], {stdio: 'ignore', timeout: 5000}); }
            catch { /* Retain the profile if its private mount cannot be released. */ }
        }
    }
    if (passed) {
        try { rmSync(root, {recursive: true, force: true}); }
        catch { console.error(`Checks passed; temporary profile cleanup incomplete: ${root}`); }
    } else console.error(`Failure logs retained at ${root}`);
}
