import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {localAddresses, configureNetwork, readNetworkConfig} from '../network-config.js';
import {RemoteService} from '../service.js';

const directory = ARGV[0];
const tools = `${directory}/tools`;
const originalPath = GLib.getenv('PATH');
GLib.mkdir_with_parents(tools, 0o700);
function tool(name, body) {
    const path = `${tools}/${name}`;
    GLib.file_set_contents(path, `#!/bin/sh\n${body}\n`);
    Gio.File.new_for_path(path).set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
}
function remove(name) { Gio.File.new_for_path(`${tools}/${name}`).delete(null); }
function check(value, message) { if (!value) throw new Error(message); }
async function rejects(action, expected) {
    try { await action(); } catch (error) {
        check(expected.test(error.message), `Unexpected error: ${error.message}`);
        return;
    }
    throw new Error(`Expected failure: ${expected}`);
}
function snapshot() {
    return new TextDecoder().decode(GLib.file_get_contents(`${directory}/network.json`)[1]);
}
const addressList = `printf '%s\\n' '[{"ifname":"test0","addr_info":[{"local":"192.168.5.4"}]}]'`;
tool('ip', addressList);
GLib.setenv('PATH', `${tools}:${originalPath}`, true);
const config = await configureNetwork('192.168.5.4', 9443, null, directory);
const before = snapshot();
try {
    GLib.setenv('PATH', tools, true);
    remove('ip');
    await rejects(() => localAddresses(), /iproute2 is required.*ip was not found.*package manager/);
    await rejects(() => configureNetwork(config.address, 9443, null, directory), /iproute2 is required/);
    tool('ip', addressList);
    await rejects(() => configureNetwork(config.address, 9443, null, directory), /OpenSSL is required.*openssl was not found.*package manager/);
    print('PASS: absent iproute2 and OpenSSL produce actionable errors');

    tool('ip', "printf '%s\\n' '[]'");
    check((await localAddresses()).length === 0, 'No-interface result must be empty');
    await rejects(() => configureNetwork(config.address, 9443, null, directory), /not assigned to an active local interface/);
    tool('ip', 'printf broken');
    await rejects(() => localAddresses(), /Could not read local network addresses from iproute2/);
    tool('ip', 'echo detection-failed >&2; exit 1');
    await rejects(() => localAddresses(), /Could not detect local network addresses.*detection-failed/);
    print('PASS: absent interfaces and failed/malformed address discovery are handled');

    tool('ip', addressList);
    // Emulate a tool that leaves partial files behind before failing.
    tool('openssl', `while [ "$#" -gt 0 ]; do
case "$1" in -keyout|-out) shift; printf partial > "$1";; esac
shift
done
echo certificate-failed >&2
exit 1`);
    await rejects(() => configureNetwork(config.address, 9443, null, directory), /Could not generate the local certificate.*certificate-failed/);
    check(snapshot() === before, 'Failed setup overwrote working configuration');
    check(readNetworkConfig(directory).fingerprint === config.fingerprint, 'Previous certificate was damaged');
    const entries = Gio.File.new_for_path(directory).enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let staged = 0;
    for (let info; (info = entries.next_file(null));) if (info.get_name().startsWith('tls-')) staged++;
    entries.close(null);
    check(staged === 1, 'Failed setup left partial credentials behind');
    print('PASS: failed certificate generation removes partial credentials and preserves working setup');

    const service = new RemoteService('.', () => {}, () => { throw Error('Unexpected input'); },
        {address: '127.0.0.1', port: 0}, () => { throw Error('Unexpected running failure'); });
    await rejects(() => service.start(), /util-linux prlimit.*Install util-linux/);
    check(service._process === null && service._pipe === null && service._startup === 0 && service._state === 'off',
        'Missing prlimit left service resources or state');
    print('PASS: absent prlimit refuses startup without a child process or active control');
} finally { GLib.setenv('PATH', originalPath, true); }
