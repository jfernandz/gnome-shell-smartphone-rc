import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export async function readText(path, cancellable = null) {
    const file = Gio.File.new_for_path(path);
    const [, bytes] = await new Promise((resolve, reject) => file.load_contents_async(cancellable, (source, result) => {
        try { resolve(source.load_contents_finish(result)); } catch (error) { reject(error); }
    }));
    return new TextDecoder().decode(bytes);
}

export async function* directoryEntries(path, attributes, cancellable = null) {
    const file = Gio.File.new_for_path(path);
    const enumerator = await new Promise((resolve, reject) => file.enumerate_children_async(attributes,
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
            try { resolve(source.enumerate_children_finish(result)); } catch (error) { reject(error); }
        }));
    try {
        while (true) {
            const entries = await new Promise((resolve, reject) => enumerator.next_files_async(32,
                GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                    try { resolve(source.next_files_finish(result)); } catch (error) { reject(error); }
                }));
            if (!entries.length) return;
            for (const entry of entries) yield entry;
        }
    } finally {
        await new Promise((resolve, reject) => enumerator.close_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
            try { source.close_finish(result); resolve(); } catch (error) { reject(error); }
        }));
    }
}

export async function deleteFile(path, cancellable = null) {
    const file = Gio.File.new_for_path(path);
    await new Promise((resolve, reject) => file.delete_async(GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
        try { source.delete_finish(result); resolve(); } catch (error) { reject(error); }
    }));
}
