import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {certificateOptions, cleanupOldCertificates} from '../certificates.js';
import {configureNetwork, readNetworkConfig} from '../network-config.js';
import {runCommand} from '../subprocess.js';
const root = ARGV[0];
const directory = `${root}/config`;
const tools = `${root}/tools`;
const originalPath = GLib.getenv('PATH');
const gjs = GLib.find_program_in_path('gjs');
const decode = path => new TextDecoder().decode(GLib.file_get_contents(path)[1]);
const exists = path => Gio.File.new_for_path(path).query_exists(null);
function check(value, reason) { if (!value) throw Error(reason); }
async function rejects(action, pattern) {
    try { await action(); } catch (error) {
        check(pattern.test(error.message), `Unexpected failure: ${error.message}`);
        return;
    }
    throw Error(`Expected failure: ${pattern}`);
}
function executable(name, source) {
    GLib.file_set_contents(`${tools}/${name}`, source);
    Gio.File.new_for_path(`${tools}/${name}`).set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
}
function entries() {
    const enumerator = Gio.File.new_for_path(directory).enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    const names = [];
    for (let info; (info = enumerator.next_file(null));) names.push(info.get_name());
    enumerator.close(null);
    return names.sort().join(',');
}
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
GLib.mkdir_with_parents(tools, 0o700);
executable('ip', '#!/bin/sh\nprintf \'%s\\n\' \'[{"ifname":"test0","addr_info":[{"local":"192.168.5.4"}]}]\'\n');
GLib.setenv('PATH', `${tools}:${originalPath}`, true);
try {
    const valid = await configureNetwork('192.168.5.4', 9443, null, directory);
    const configPath = `${directory}/network.json`;
    const before = decode(configPath);
    const originalEntries = entries();
    const validBase = Gio.File.new_for_path(valid.certificatePath).get_parent().get_path();
    await rejects(() => certificateOptions(`${root}/expired`, valid.address, 9443), /expired or is not yet valid/);
    await rejects(() => certificateOptions(`${root}/future`, valid.address, 9443), /expired or is not yet valid/);
    await rejects(() => certificateOptions(validBase, '192.168.5.99', 9443), /does not match the LAN address/);
    print('PASS: real expired, future and wrong-IP certificates are rejected');

    executable('openssl', `#!/bin/sh
while [ "$#" -gt 0 ]; do
case "$1" in
-keyout) shift; /bin/cp ${quote(`${root}/expired/private-key.pem`)} "$1";;
-out) shift; /bin/cp ${quote(`${root}/expired/certificate.pem`)} "$1";;
esac
shift
done
`);
    await rejects(() => configureNetwork(valid.address, 9443, null, directory), /expired or is not yet valid/);
    check(decode(configPath) === before && entries() === originalEntries, 'Invalid certificate changed working setup or left staging files');
    check((await readNetworkConfig(directory)).fingerprint === valid.fingerprint, 'Working certificate was replaced');
    // Rejecting publication must remove the newly generated files, too.
    Gio.File.new_for_path(`${tools}/openssl`).delete(null);
    Gio.File.new_for_path(configPath).delete(null);
    Gio.File.new_for_path(configPath).make_directory(null);
    GLib.file_set_contents(`${configPath}/keep`, 'prevent replacement');
    await rejects(() => configureNetwork(valid.address, 9443, null, directory), /./);
    check(entries() === originalEntries, 'Failed publication left credential directories');
    Gio.File.new_for_path(`${configPath}/keep`).delete(null);
    Gio.File.new_for_path(configPath).delete(null);
    GLib.file_set_contents(configPath, before);
    print('PASS: invalid generation and failed publication preserve existing credential files');

    const ready = `${root}/ready`;
    executable('openssl', `#!${gjs} -m
import GLib from 'gi://GLib';
for (let i = 0; i < ARGV.length; i++)
    if (['-keyout', '-out'].includes(ARGV[i])) GLib.file_set_contents(ARGV[++i], 'partial');
GLib.file_set_contents(${JSON.stringify(ready)}, GLib.file_read_link('/proc/self'));
new GLib.MainLoop(null, false).run();
`);
    const cancel = new Gio.Cancellable();
    const poll = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
        if (!exists(ready)) return GLib.SOURCE_CONTINUE;
        cancel.cancel();
        return GLib.SOURCE_REMOVE;
    });
    try { await rejects(() => configureNetwork(valid.address, 9443, cancel, directory), /cancel/i); }
    finally { if (GLib.MainContext.default().find_source_by_id(poll)) GLib.Source.remove(poll); }
    check(exists(ready) && !exists(`/proc/${decode(ready)}`), 'Cancellation returned before the child was reaped');
    check(decode(configPath) === before && entries() === originalEntries, 'Cancellation changed setup or left partial files');
    print('PASS: cancelled certificate generation reaps the child before deleting partial files');

    Gio.File.new_for_path(ready).delete(null);
    await rejects(() => runCommand(['openssl'], {timeoutMs: 200, operation: 'Test operation'}), /command timed out/);
    check(exists(ready) && !exists(`/proc/${decode(ready)}`), 'Timeout returned before the child was reaped');
    print('PASS: command timeout reaps its direct child');

    const old = 'tls-11111111-1111-1111-1111-111111111111';
    const recent = 'tls-22222222-2222-2222-2222-222222222222';
    const pending = '.pending-tls-33333333-3333-3333-3333-333333333333';
    const unexpected = 'tls-44444444-4444-4444-4444-444444444444';
    for (const name of [old, recent, pending, unexpected]) {
        GLib.mkdir_with_parents(`${directory}/${name}`, 0o700);
        for (const file of ['private-key.pem', 'certificate.pem']) GLib.file_set_contents(`${directory}/${name}/${file}`, 'fixture');
    }
    GLib.file_set_contents(`${directory}/${unexpected}/keep`, 'do not recurse');
    const now = Math.floor(Date.now() / 1000);
    for (const base of [validBase, `${directory}/${old}`, `${directory}/${pending}`, `${directory}/${unexpected}`])
        Gio.File.new_for_path(base).set_attribute_uint64('time::modified', now - 172800, Gio.FileQueryInfoFlags.NONE, null);
    Gio.File.new_for_path(`${directory}/tls-55555555-5555-5555-5555-555555555555`).make_symbolic_link(`${root}/expired`, null);
    await cleanupOldCertificates(directory, now);
    check(!exists(`${directory}/${old}`), 'Unreferenced old generation was not removed');
    check(exists(valid.certificatePath) && exists(`${directory}/${recent}/private-key.pem`) && exists(`${directory}/${pending}/private-key.pem`),
        'Cleanup removed selected, recent or in-progress credentials');
    check(exists(`${root}/expired/private-key.pem`) && exists(`${directory}/${unexpected}/keep`) &&
        exists(`${directory}/${unexpected}/private-key.pem`), 'Cleanup followed a symlink or recursed into unknown files');
    print('PASS: cleanup retains selected/recent/staged credentials and never follows symlinks or recurses');
} finally { GLib.setenv('PATH', originalPath, true); }
