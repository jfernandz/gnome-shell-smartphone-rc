import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ExtensionState, ExtensionType} from 'resource:///org/gnome/shell/misc/extensionUtils.js';

const UUID = 'smartphone-rc@jfaparicio.github.io';
let installing = false;

async function command(argv) {
    const process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const [, output, errors] = await new Promise((resolve, reject) => process.communicate_utf8_async(null, null, (source, result) => {
        try { resolve(source.communicate_utf8_finish(result)); } catch (error) { reject(error); }
    }));
    if (!process.get_successful()) throw Error(errors.trim() || `${argv[0]} failed.`);
    return output.trim();
}

async function unload() {
    const extension = Main.extensionManager.lookup(UUID);
    if (extension) await Main.extensionManager.unloadExtension(extension);
}

async function loadInstalled(installedPath, transaction, label) {
    // GJS preserves this symlink URI for the entire relative import graph.
    // The files themselves stay in the normal ZIP installation directory.
    const alias = Gio.File.new_for_path(`${transaction}/${label}/${UUID}`);
    GLib.mkdir_with_parents(alias.get_parent().get_path(), 0o700);
    alias.make_symbolic_link(installedPath, null);
    const manager = Main.extensionManager;
    // Development-only: invalidate this extension's numeric-version reload guard,
    // too. Other extensions and their cached-version guards are untouched.
    manager._unloadedExtensions.delete(UUID);
    const extension = manager.createExtensionObject(UUID, alias, ExtensionType.PER_USER);
    manager.enableExtension(UUID);
    await manager.loadExtension(extension);
    for (let i = 0; i < 250 && !extension.error &&
        ![ExtensionState.ACTIVE, ExtensionState.ERROR, ExtensionState.OUT_OF_DATE].includes(extension.state); i++)
        await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => { resolve(); return GLib.SOURCE_REMOVE; }));
    if (extension.error || extension.state !== ExtensionState.ACTIVE)
        throw Error(extension.error || `Extension did not become active (state ${extension.state}).`);
    return extension;
}

// Install only the explicitly selected ZIP, then load those installed files.
// This never calls the source builder or copies project runtime files.
export async function installZip(archivePath = null) {
    if (archivePath === null) {
        const selected = Gio.File.new_for_path(`${GLib.get_user_cache_dir()}/smartphone-rc/selected-zip.json`);
        let bytes;
        try {
            [, bytes] = await new Promise((resolve, reject) => selected.load_contents_async(null, (source, result) => {
                try { resolve(source.load_contents_finish(result)); } catch (error) { reject(error); }
            }));
        } catch (error) {
            throw new Error('Select a ZIP first with bash scripts/prepare-zip-install.sh.', {cause: error});
        }
        archivePath = JSON.parse(new TextDecoder().decode(bytes)).archivePath;
    }
    if (installing) throw Error('A ZIP installation is already in progress.');
    if (typeof archivePath !== 'string' || !GLib.path_is_absolute(archivePath))
        throw Error('Pass the absolute path of the extension ZIP to install.');
    installing = true;
    let transaction, installedPath, hadInstallation = false, previous = null;
    let replacing = false;
    try {
        const metadata = JSON.parse(await command(['unzip', '-p', archivePath, 'metadata.json']));
        if (metadata.uuid !== UUID) throw Error(`This installer only accepts ${UUID}.`);
        // Let the official installer validate/unpack the archive. Check our entry
        // point first so an obviously incomplete ZIP cannot stop the active copy.
        await command(['unzip', '-p', archivePath, 'extension.js']);
        const installed = Gio.File.new_for_path(`${GLib.get_user_data_dir()}/gnome-shell/extensions/${UUID}`);
        installedPath = installed.get_path();
        hadInstallation = installed.query_exists(null);
        if (hadInstallation && installed.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) !== Gio.FileType.DIRECTORY)
            throw Error('The installed extension path must be a regular directory, not a symlink or file.');
        const cache = `${GLib.get_user_cache_dir()}/smartphone-rc`;
        GLib.mkdir_with_parents(cache, 0o700);
        transaction = `${cache}/zip-install-${GLib.uuid_string_random()}`;
        const transactionDir = Gio.File.new_for_path(transaction);
        transactionDir.make_directory(null);
        transactionDir.set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
        if (hadInstallation) await command(['cp', '-a', '--', installedPath, `${transaction}/previous`]);
        previous = Main.extensionManager.lookup(UUID);
        await unload();
        replacing = true;
        const installedUuid = await command(['gnome-extensions', 'install', '--force', '--print-uuid', archivePath]);
        if (installedUuid !== UUID) throw Error('The ZIP installer returned an unexpected extension UUID.');
        const extension = await loadInstalled(installedPath, transaction, 'installed');
        return `Installed and loaded ${extension.metadata['version-name'] ?? extension.metadata.version ?? 'unknown version'} from ${archivePath}. Files: ${installedPath}`;
    } catch (error) {
        if (!replacing) throw error;
        try {
            await unload();
            // Keep a failed installation for diagnosis; restore the old directory
            // including compiled schemas. Configuration outside it is untouched.
            if (Gio.File.new_for_path(installedPath).query_exists(null))
                await command(['mv', '--', installedPath, `${transaction}/failed`]);
            if (hadInstallation) {
                await command(['cp', '-a', '--', `${transaction}/previous`, installedPath]);
                if (previous) await loadInstalled(installedPath, transaction, 'restored');
            } else if (previous) {
                // The active copy may have been a source snapshot with no normal install.
                const manager = Main.extensionManager;
                manager._unloadedExtensions.delete(UUID);
                const restored = manager.createExtensionObject(UUID, previous.dir, previous.type);
                manager.enableExtension(UUID);
                await manager.loadExtension(restored);
                if (restored.error) throw new Error(restored.error, {cause: error});
            }
        } catch (rollback) {
            throw new Error(`${error.message} Restore also failed: ${rollback.message}. Backup: ${transaction}/previous`, {cause: rollback});
        }
        throw new Error(`${error.message} Previous installation restored.`, {cause: error});
    } finally { installing = false; }
}
