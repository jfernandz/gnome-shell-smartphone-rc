import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {isPrivateIPv4} from './network.js';
import {readText} from './file-io.js';
import {runCommand} from './subprocess.js';
import {certificateOptions, removeStagedCertificate} from './certificates.js';

export function configDirectory() {
    return `${GLib.get_user_config_dir()}/smartphone-rc`;
}

export async function localAddresses(cancellable = null) {
    const output = await runCommand(['ip', '-j', '-4', 'address', 'show', 'up'], {cancellable, packageName: 'iproute2', operation: 'Could not detect local network addresses'});
    try {
        const devices = JSON.parse(output);
        if (!Array.isArray(devices) || devices.some(device => typeof device.ifname !== 'string' || !Array.isArray(device.addr_info)))
            throw new Error('Invalid address list');
        return devices.flatMap(device => device.addr_info
            .filter(info => info && isPrivateIPv4(info.local))
            .map(info => ({address: info.local, name: device.ifname})));
    } catch {
        throw new Error('Could not read local network addresses from iproute2. Check its installation and try again.');
    }
}

export async function readNetworkConfig(directory = configDirectory(), cancellable = null) {
    const config = JSON.parse(await readText(`${directory}/network.json`, cancellable));
    const {address, port = 8844, credentials} = config;
    if (!isPrivateIPv4(address) || !Number.isInteger(port) || port < 1024 || port > 65535)
        throw new Error('Choose a private LAN IPv4 address and a port between 1024 and 65535 in Settings → Service → Network.');
    if (credentials !== undefined && !/^tls-[a-f0-9-]{36}$/.test(credentials))
        throw new Error('Invalid certificate configuration. Configure networking again in Settings.');
    const base = credentials ? `${directory}/${credentials}` : directory;
    return certificateOptions(base, address, port, null, cancellable);
}

export async function configureNetwork(address, port, cancellable = null, directory = configDirectory()) {
    if (!isPrivateIPv4(address) || !Number.isInteger(port) || port < 1024 || port > 65535)
        throw new Error('Choose a private LAN IPv4 address and a port between 1024 and 65535.');
    const addresses = await localAddresses(cancellable);
    if (!addresses.some(item => item.address === address))
        throw new Error('This address is not assigned to an active local interface. Refresh the address list.');
    const root = Gio.File.new_for_path(directory);
    GLib.mkdir_with_parents(directory, 0o700);
    root.set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
    const credentials = `tls-${GLib.uuid_string_random()}`;
    let base = `${directory}/.pending-${credentials}`;
    Gio.File.new_for_path(base).make_directory(null);
    Gio.File.new_for_path(base).set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
    try {
        await runCommand(['openssl', 'req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
            '-nodes', '-sha256', '-days', '90', '-keyout', `${base}/private-key.pem`, '-out', `${base}/certificate.pem`,
            '-subj', '/CN=Smartphone Remote Control', '-addext', `subjectAltName=IP:${address}`,
            '-addext', 'basicConstraints=critical,CA:FALSE', '-addext', 'keyUsage=critical,digitalSignature',
            '-addext', 'extendedKeyUsage=serverAuth'], {cancellable, packageName: 'OpenSSL', operation: 'Could not generate the local certificate'});
        for (const name of ['private-key.pem', 'certificate.pem'])
            Gio.File.new_for_path(`${base}/${name}`).set_attribute_uint32('unix::mode', 0o600, Gio.FileQueryInfoFlags.NONE, null);
        const validated = await certificateOptions(base, address, port, null, cancellable);
        cancellable?.set_error_if_cancelled();
        const destination = `${directory}/${credentials}`;
        Gio.File.new_for_path(base).move(Gio.File.new_for_path(destination), Gio.FileCopyFlags.NONE, cancellable, null);
        base = destination;
        const result = {...validated, certificatePath: `${base}/certificate.pem`, privateKeyPath: `${base}/private-key.pem`};
        // The last fallible operation publishes already validated files. Nothing after
        // this commit may enter rollback and remove the referenced credentials.
        Gio.File.new_for_path(`${directory}/network.json`).replace_contents(
            JSON.stringify({address, port, credentials}), null, false, Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, cancellable);
        return result;
    } catch (error) {
        removeStagedCertificate(base);
        throw error;
    }
}
