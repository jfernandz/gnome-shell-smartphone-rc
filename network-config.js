import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {isPrivateIPv4} from './network.js';

const decoder = new TextDecoder();
export function configDirectory() {
    return `${GLib.get_user_config_dir()}/smartphone-rc`;
}

async function command(argv, cancellable = null) {
    const process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 15, () => {
        process.force_exit();
        return GLib.SOURCE_REMOVE;
    });
    try {
        const [, output, error] = await new Promise((resolve, reject) =>
            process.communicate_utf8_async(null, cancellable, (source, result) => {
                try { resolve(source.communicate_utf8_finish(result)); } catch (e) { reject(e); }
            }));
        if (!process.get_successful())
            throw new Error(error.trim() || `${argv[0]} failed. Check that the required tool is installed.`);
        return output;
    } finally {
        // Cancelling communication must also stop certificate generation.
        process.force_exit();
        if (GLib.MainContext.default().find_source_by_id(timer))
            GLib.Source.remove(timer);
    }
}

export async function localAddresses(cancellable = null) {
    const output = await command(['ip', '-j', '-4', 'address', 'show', 'up'], cancellable);
    return JSON.parse(output).flatMap(device => device.addr_info
        .filter(info => isPrivateIPv4(info.local))
        .map(info => ({address: info.local, name: device.ifname})));
}

export function readNetworkConfig(directory = configDirectory()) {
    const [, contents] = GLib.file_get_contents(`${directory}/network.json`);
    const config = JSON.parse(decoder.decode(contents));
    const {address, port = 8844, credentials} = config;
    if (!isPrivateIPv4(address) || !Number.isInteger(port) || port < 1024 || port > 65535)
        throw new Error('Choose a private LAN IPv4 address and a port between 1024 and 65535 in Settings → Network.');
    if (credentials !== undefined && !/^tls-[a-f0-9-]{36}$/.test(credentials))
        throw new Error('Invalid certificate configuration. Configure networking again in Settings.');
    const base = credentials ? `${directory}/${credentials}` : directory;
    const certificatePath = `${base}/certificate.pem`;
    const privateKeyPath = `${base}/private-key.pem`;
    const certificate = Gio.TlsCertificate.new_from_files(certificatePath, privateKeyPath);
    const errors = certificate.verify(new Gio.NetworkAddress({hostname: address, port}), null);
    const invalid = Gio.TlsCertificateFlags.BAD_IDENTITY | Gio.TlsCertificateFlags.EXPIRED | Gio.TlsCertificateFlags.NOT_ACTIVATED;
    if (errors & invalid)
        throw new Error('The certificate has expired or does not match the address. Configure networking again in Settings.');
    const fingerprint = GLib.compute_checksum_for_data(GLib.ChecksumType.SHA256, certificate.certificate)
        .toUpperCase().match(/.{2}/g).join(':');
    return {address, port, certificatePath, privateKeyPath, fingerprint,
        expires: certificate.get_not_valid_after()?.format('%Y-%m-%d') ?? 'Unknown'};
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
    const base = `${directory}/${credentials}`;
    GLib.mkdir_with_parents(base, 0o700);
    try {
        await command(['openssl', 'req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
            '-nodes', '-sha256', '-days', '90', '-keyout', `${base}/private-key.pem`, '-out', `${base}/certificate.pem`,
            '-subj', '/CN=Smartphone Remote Control', '-addext', `subjectAltName=IP:${address}`,
            '-addext', 'basicConstraints=critical,CA:FALSE', '-addext', 'keyUsage=critical,digitalSignature',
            '-addext', 'extendedKeyUsage=serverAuth'], cancellable);
        for (const name of ['private-key.pem', 'certificate.pem'])
            Gio.File.new_for_path(`${base}/${name}`).set_attribute_uint32('unix::mode', 0o600, Gio.FileQueryInfoFlags.NONE, null);
        const certificate = Gio.TlsCertificate.new_from_files(`${base}/certificate.pem`, `${base}/private-key.pem`);
        if (certificate.verify(new Gio.NetworkAddress({hostname: address, port}), null) & Gio.TlsCertificateFlags.BAD_IDENTITY)
            throw new Error('Generated certificate does not match the selected address.');
        // Commit last: failures leave the previous working configuration intact.
        Gio.File.new_for_path(`${directory}/network.json`).replace_contents(
            JSON.stringify({address, port, credentials}), null, false, Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, cancellable);
        return readNetworkConfig(directory);
    } catch (error) {
        for (const name of ['private-key.pem', 'certificate.pem']) {
            try { Gio.File.new_for_path(`${base}/${name}`).delete(null); } catch { /* Not created yet. */ }
        }
        Gio.File.new_for_path(base).delete(null);
        throw error;
    }
}
