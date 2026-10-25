#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/smartphone-rc"
mkdir -p "$cache_dir"
build_dir=$(mktemp -d "$cache_dir/build-XXXXXX")
# A fresh import path avoids GNOME Shell's JavaScript module cache.
extension_dir="$build_dir/gnome-shell/extensions/smartphone-rc@jfaparicio.github.io"
bash "$project_dir/scripts/lib/stage.sh" "$extension_dir"
if [[ "${1:-}" == '--build-only' ]]; then
    printf '%s\n' "$extension_dir"
    exit 0
fi
echo 'Open Looking Glass with Alt+F2, lg, Enter. Paste this reusable command:'
gjs -c 'print(`await (await import(${JSON.stringify(ARGV[0])})).reload()`) ' "file://$project_dir/scripts/reload.js"
echo 'Future updates: recall the same command with Up and press Enter. It builds the latest source automatically.'
