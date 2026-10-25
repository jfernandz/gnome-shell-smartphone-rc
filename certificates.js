import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {readText, directoryEntries, deleteFile} from './file-io.js';

export async function certificateOptions(base, address, port, now = null, cancellable = null) {
    const certificatePath = `${base}/certificate.pem`;
    const privateKeyPath = `${base}/private-key.pem`;
    const [pem, key] = await Promise.all([readText(certificatePath, cancellable), readText(privateKeyPath, cancellable)]);
    cancellable?.set_error_if_cancelled();
    const certificate = Gio.TlsCertificate.new_from_pem(`${pem}\n${key}`, -1);
    now ??= GLib.DateTime.new_now_utc();
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
export async function cleanupOldCertificates(directory, nowSeconds = Date.now() / 1000, cancellable = null) {
    try {
        const {credentials} = JSON.parse(await readText(`${directory}/network.json`, cancellable));
        if (!GENERATED.test(credentials)) return;
        for await (const info of directoryEntries(directory, 'standard::name,standard::type,time::modified', cancellable)) {
            const name = info.get_name();
            if (name === credentials || !GENERATED.test(name) || info.get_file_type() !== Gio.FileType.DIRECTORY ||
                nowSeconds - info.get_attribute_uint64('time::modified') < 86400)
                continue;
            const base = `${directory}/${name}`;
            let owned = true;
            for await (const file of directoryEntries(base, 'standard::name,standard::type', cancellable)) {
                if (!['private-key.pem', 'certificate.pem'].includes(file.get_name()) || file.get_file_type() !== Gio.FileType.REGULAR)
                    owned = false;
            }
            if (!owned) continue;
            for (const file of ['private-key.pem', 'certificate.pem']) {
                try { await deleteFile(`${base}/${file}`, cancellable); } catch (error) {
                    if (!error.matches?.(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND)) throw error;
                }
            }
            await deleteFile(base, cancellable);
        }
    } catch (error) {
        if (cancellable?.is_cancelled()) throw error;
        // Cleanup is optional; configuration validation reports actual setup errors.
    }
}
