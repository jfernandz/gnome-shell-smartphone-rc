#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/smartphone-rc@jfaparicio.github.io"
mkdir -p "$extension_dir/web"
for file in metadata.json extension.js input.js server.js protocol.js network.js focus.js dialogs.js settings.js trusted.js prefs.js stylesheet.css; do
    install -m 644 "$project_dir/$file" "$extension_dir/$file"
done
for file in index.html app.js editing.js keyboard.js touchpad.js viewport.js style.css; do
    install -m 644 "$project_dir/web/$file" "$extension_dir/web/$file"
done
mkdir -p "$extension_dir/schemas"
install -m 644 "$project_dir"/schemas/*.gschema.xml "$extension_dir/schemas/"
glib-compile-schemas --strict "$extension_dir/schemas"
echo "Installed to $extension_dir"
echo 'To load or update without logging out: bash scripts/prepare-reload.sh'
echo 'Then run: gnome-extensions enable smartphone-rc@jfaparicio.github.io'
