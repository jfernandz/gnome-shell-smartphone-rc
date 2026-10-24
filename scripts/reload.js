import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Development only: build a fresh snapshot before replacing this extension.
export async function reload() {
    const directory = Gio.File.new_for_uri(import.meta.url).get_parent();
    const process = Gio.Subprocess.new(
        ['bash', directory.get_child('prepare-reload.sh').get_path(), '--build-only'],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const [, stdout, stderr] = await new Promise((resolve, reject) => {
        process.communicate_utf8_async(null, null, (subprocess, result) => {
            try {
                resolve(subprocess.communicate_utf8_finish(result));
            } catch (error) {
                reject(error);
            }
        });
    });
    if (!process.get_successful())
        throw new Error(`Could not prepare development build: ${stderr.trim()}`);
    const path = stdout.trim();
    const dir = Gio.File.new_for_path(path);
    if (!dir.get_child('metadata.json').query_exists(null))
        throw new Error('The development build is missing extension metadata.');

    const uuid = 'smartphone-rc@jfaparicio.github.io';
    const manager = Main.extensionManager;
    const old = manager.lookup(uuid);
    if (old)
        await manager.unloadExtension(old);
    const extension = manager.createExtensionObject(uuid, dir, 2);
    await manager.loadExtension(extension);
    if (extension.error)
        throw new Error(extension.error);
    manager.enableExtension(uuid);
    return `Loaded Smartphone Remote Control from ${path}`;
}
