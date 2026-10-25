import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_parent();
const [, bytes] = GLib.file_get_contents(directory.get_child('resources.json').get_path());
const manifest = JSON.parse(new TextDecoder().decode(bytes));
const files = [...new Set([...manifest.runtime, ...Object.values(manifest.web).map(asset => asset.file)])];
for (const file of files) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(file) || file.startsWith('/') || file.split('/').includes('..'))
        throw new Error(`Invalid runtime path: ${file}`);
}
if (ARGV[0] === '--extra') {
    const defaults = new Set(['metadata.json', 'extension.js', 'prefs.js', 'stylesheet.css', 'schemas']);
    for (const file of new Set(files.map(path => path.split('/')[0]))) {
        if (!defaults.has(file))
            print(file);
    }
} else {
    for (const file of files)
        print(file);
}
