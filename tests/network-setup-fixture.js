import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {configureNetwork, readNetworkConfig, localAddresses} from '../network-config.js';
const directory = ARGV[0];
const addresses = await localAddresses();
if (!addresses.length) throw new Error('This integration check requires an active private LAN address.');
const config = await configureNetwork(addresses[0].address, 9443, null, directory);
if (config.port !== 9443 || !config.fingerprint || !config.expires)
    throw new Error('Missing generated certificate details.');
for (const path of [directory, config.privateKeyPath, `${directory}/network.json`]) {
    const mode = Gio.File.new_for_path(path).query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null).get_attribute_uint32('unix::mode') & 0o777;
    if (mode !== (path === directory ? 0o700 : 0o600)) throw new Error(`Unsafe permissions: ${mode}`);
}
const [,before] = GLib.file_get_contents(`${directory}/network.json`);
for (const [address, port] of [['8.8.8.8', 9443], [addresses[0].address, 443], ['192.168.255.254', 9443]]) {
    try { await configureNetwork(address, port, null, directory); throw new Error('Accepted invalid configuration'); }
    catch (error) { if (error.message === 'Accepted invalid configuration') throw error; }
}
// Simulate a tool failure after address discovery and staging, not just validation.
const tools = `${directory}/tools`;
GLib.mkdir_with_parents(tools, 0o700);
GLib.file_set_contents(`${tools}/openssl`, '#!/bin/sh\nexit 1\n');
Gio.File.new_for_path(`${tools}/openssl`).set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
const previousPath = GLib.getenv('PATH');
GLib.setenv('PATH', `${tools}:${previousPath}`, true);
try {
    await configureNetwork(addresses[0].address, 9443, null, directory);
    throw new Error('Accepted failed certificate generation');
} catch (error) {
    if (error.message === 'Accepted failed certificate generation') throw error;
} finally { GLib.setenv('PATH', previousPath, true); }
const [,after] = GLib.file_get_contents(`${directory}/network.json`);
if (new TextDecoder().decode(before) !== new TextDecoder().decode(after)) throw new Error('Failed setup changed existing configuration');
// The pre-preferences setup format remains usable.
GLib.file_set_contents(`${directory}/certificate.pem`, GLib.file_get_contents(config.certificatePath)[1]);
GLib.file_set_contents(`${directory}/private-key.pem`, GLib.file_get_contents(config.privateKeyPath)[1]);
GLib.file_set_contents(`${directory}/network.json`, JSON.stringify({address: config.address}));
if (readNetworkConfig(directory).port !== 8844) throw new Error('Legacy configuration failed');
print('PASS: setup, certificate identity, port, private permissions, failure preservation and legacy configuration');
