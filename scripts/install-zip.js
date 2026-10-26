import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ExtensionState, ExtensionType} from 'resource:///org/gnome/shell/misc/extensionUtils.js';

const UUID = 'smartphone-rc@jfaparicio.github.io';
let installing = false;

// Looking Glass may import this module through the stable cache symlink.
let sourcePath = Gio.File.new_for_uri(import.meta.url).get_path();
try { sourcePath = GLib.file_read_link(sourcePath); } catch { /* Direct project import. */ }
let sourceDirectory = Gio.File.new_for_path(sourcePath).get_parent();
try {
    const target = GLib.file_read_link(sourceDirectory.get_path());
    sourceDirectory = sourceDirectory.get_parent().resolve_relative_path(target);
} catch { /* The scripts directory is not a symlink. */ }
const {runCommand} = await import(sourceDirectory.get_parent().get_child('subprocess.js').get_uri());

async function command(argv, cancellable = null) {
    return (await runCommand(argv, {cancellable, timeoutMs: 30000})).trim();
}

function restoreEnabled(enabled) {
    const manager = Main.extensionManager;
    if (enabled) manager.enableExtension(UUID);
    else manager.disableExtension(UUID);
}

async function unload() {
    const extension = Main.extensionManager.lookup(UUID);
    if (extension) await Main.extensionManager.unloadExtension(extension);
}

async function loadInstalled(installedPath, transaction, label, enabled = true) {
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
    restoreEnabled(enabled);
    await manager.loadExtension(extension);
    if (extension.error) throw Error(extension.error);
    if (!enabled) return extension;
    for (let i = 0; i < 250 && !extension.error &&
        ![ExtensionState.ACTIVE, ExtensionState.ERROR, ExtensionState.OUT_OF_DATE].includes(extension.state); i++)
        await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => { resolve(); return GLib.SOURCE_REMOVE; }));
    if (extension.error || extension.state !== ExtensionState.ACTIVE)
        throw Error(extension.error || `Extension did not become active (state ${extension.state}).`);
    return extension;
}

// Install only the explicitly selected ZIP, then load those installed files.
// This never calls the source builder or copies project runtime files.
export async function installZip(archivePath = null, {cancellable = null} = {}) {
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
    let archiveCopy = null;
    const wasEnabled = global.settings.get_strv('enabled-extensions').includes(UUID) &&
        !global.settings.get_strv('disabled-extensions').includes(UUID) &&
        !global.settings.get_boolean('disable-user-extensions');
    const priorSettings = ['enabled-extensions', 'disabled-extensions'].map(key =>
        [key, global.settings.get_strv(key).includes(UUID)]);
    const restoreSettings = () => {
        for (const [key, included] of priorSettings) {
            const current = global.settings.get_strv(key);
            if (current.includes(UUID) !== included)
                global.settings.set_strv(key, included ? [...current, UUID] : current.filter(uuid => uuid !== UUID));
        }
    };
    try {
        const cache = `${GLib.get_user_cache_dir()}/smartphone-rc`;
        GLib.mkdir_with_parents(cache, 0o700);
        transaction = await command(['mktemp', '-d', `${cache}/zip-install-XXXXXX`], cancellable);
        archiveCopy = Gio.File.new_for_path(`${transaction}/archive.zip`);
        await new Promise((resolve, reject) => Gio.File.new_for_path(archivePath).copy_async(
            archiveCopy, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable, null, (source, result) => {
                try { source.copy_finish(result); resolve(); } catch (error) { reject(error); }
            }));
        archiveCopy.set_attribute_uint32('unix::mode', 0o600, Gio.FileQueryInfoFlags.NONE, null);
        const snapshot = archiveCopy.get_path();
        const metadata = JSON.parse(await command(['unzip', '-p', snapshot, 'metadata.json'], cancellable));
        if (metadata.uuid !== UUID) throw Error(`This installer only accepts ${UUID}.`);
        await command(['unzip', '-p', snapshot, 'extension.js'], cancellable);
        const installed = Gio.File.new_for_path(`${GLib.get_user_data_dir()}/gnome-shell/extensions/${UUID}`);
        installedPath = installed.get_path();
        hadInstallation = installed.query_exists(null);
        if (hadInstallation && installed.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) !== Gio.FileType.DIRECTORY)
            throw Error('The installed extension path must be a regular directory, not a symlink or file.');
        if (hadInstallation) await command(['cp', '-a', '--', installedPath, `${transaction}/previous`], cancellable);
        previous = Main.extensionManager.lookup(UUID);
        cancellable?.set_error_if_cancelled();
        replacing = true;
        await unload();
        const installedUuid = await command(['gnome-extensions', 'install', '--force', '--print-uuid', snapshot], cancellable);
        if (installedUuid !== UUID) throw Error('The ZIP installer returned an unexpected extension UUID.');
        cancellable?.set_error_if_cancelled();
        const extension = await loadInstalled(installedPath, transaction, 'installed');
        cancellable?.set_error_if_cancelled();
        return `Installed and loaded ${extension.metadata['version-name'] ?? extension.metadata.version ?? 'unknown version'} from ${archivePath}. Files: ${installedPath}`;
    } catch (error) {
        if (!replacing) throw error;
        try {
            await unload();
            restoreSettings();
            // Settings changes are queued by Shell. Settle them before loading a
            // disabled copy, otherwise loadExtension() can see stale enablement.
            await Main.extensionManager._onEnabledExtensionsChanged();
            // Keep a failed installation for diagnosis; restore the old directory
            // including compiled schemas. Configuration outside it is untouched.
            if (Gio.File.new_for_path(installedPath).query_exists(null))
                await command(['mv', '--', installedPath, `${transaction}/failed`]);
            if (hadInstallation) {
                await command(['cp', '-a', '--', `${transaction}/previous`, installedPath]);
                if (previous) await loadInstalled(installedPath, transaction, 'restored', wasEnabled);
            } else if (previous) {
                // The active copy may have been a source snapshot with no normal install.
                const manager = Main.extensionManager;
                manager._unloadedExtensions.delete(UUID);
                const restored = manager.createExtensionObject(UUID, previous.dir, previous.type);
                restoreEnabled(wasEnabled);
                await manager.loadExtension(restored);
                if (restored.error) throw new Error(restored.error, {cause: error});
            }
            restoreSettings();
        } catch (rollback) {
            restoreSettings();
            throw new Error(`${error.message} Restore also failed: ${rollback.message}. Backup: ${transaction}/previous`, {cause: rollback});
        }
        throw new Error(`${error.message} Previous installation restored.`, {cause: error});
    } finally {
        try {
            if (archiveCopy?.query_exists(null)) archiveCopy.delete(null);
        } finally { installing = false; }
    }
}
