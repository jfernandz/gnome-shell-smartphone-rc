#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/smartphone-rc@jfaparicio.github.io"
mkdir -p "$extension_dir/web"
for file in metadata.json extension.js input.js server.js protocol.js; do
    install -m 644 "$project_dir/$file" "$extension_dir/$file"
done
for file in index.html app.js style.css; do
    install -m 644 "$project_dir/web/$file" "$extension_dir/web/$file"
done
echo "Installed to $extension_dir"
echo 'On Wayland, log out and back in if this is the first installation.'
echo 'Then run: gnome-extensions enable smartphone-rc@jfaparicio.github.io'
