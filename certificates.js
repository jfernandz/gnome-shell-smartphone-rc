import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function certificateOptions(base, address, port, now = GLib.DateTime.new_now_utc()) {
    const certificatePath = `${base}/certificate.pem`;
    const privateKeyPath = `${base}/private-key.pem`;
    const certificate = Gio.TlsCertificate.new_from_files(certificatePath, privateKeyPath);
    const before = certificate.get_not_valid_before();
    const after = certificate.get_not_valid_after();
    // Do not rely on verify() to report self-signed certificate validity dates.
    if (!before || !after || before.compare(now) > 0 || after.compare(now) <= 0)
        throw new Error('The certificate has expired or is not yet valid. Configure networking again in Settings.');
    if (!certificate.get_ip_addresses()?.some(ip => ip.to_string() === address))
        throw new Error('The certificate does not match the LAN address. Configure networking again in Settings.');
    const errors = certificate.verify(new Gio.NetworkAddress({hostname: address, port}), null);
    // UNKNOWN_CA is expected for our self-signed certificate; other errors are not.
    if (errors & ~Gio.TlsCertificateFlags.UNKNOWN_CA)
        throw new Error('The local certificate is invalid. Configure networking again in Settings.');
    const fingerprint = GLib.compute_checksum_for_data(GLib.ChecksumType.SHA256, certificate.certificate)
        .toUpperCase().match(/.{2}/g).join(':');
    return {address, port, certificatePath, privateKeyPath, fingerprint, expires: after.format('%Y-%m-%d')};
}

const GENERATED = /^tls-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function removeStagedCertificate(base) {
    for (const name of ['private-key.pem', 'certificate.pem']) {
        try { Gio.File.new_for_path(`${base}/${name}`).delete(null); } catch { /* May not have been created. */ }
    }
    try { Gio.File.new_for_path(base).delete(null); } catch { /* Never recurse into unexpected files. */ }
}

// Call only from Shell after stopping its previous helper, before starting another.
// Ignore staging directories, recent generations and all legacy/unrecognized files.
export function cleanupOldCertificates(directory, nowSeconds = Date.now() / 1000) {
    try {
        const [, contents] = GLib.file_get_contents(`${directory}/network.json`);
        const {credentials} = JSON.parse(new TextDecoder().decode(contents));
        if (!GENERATED.test(credentials)) return;
        const entries = Gio.File.new_for_path(directory).enumerate_children(
            'standard::name,standard::type,time::modified', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        try {
            for (let info; (info = entries.next_file(null));) {
                const name = info.get_name();
                if (name === credentials || !GENERATED.test(name) || info.get_file_type() !== Gio.FileType.DIRECTORY ||
                    nowSeconds - info.get_attribute_uint64('time::modified') < 86400)
                    continue;
                const base = `${directory}/${name}`;
                const files = Gio.File.new_for_path(base).enumerate_children('standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                let owned = true;
                try {
                    for (let file; (file = files.next_file(null));) {
                        if (!['private-key.pem', 'certificate.pem'].includes(file.get_name()) || file.get_file_type() !== Gio.FileType.REGULAR)
                            owned = false;
                    }
                } finally { files.close(null); }
                if (owned) removeStagedCertificate(base);
            }
        } finally { entries.close(null); }
    } catch { /* Cleanup is optional; configuration validation reports actual setup errors. */ }
}
