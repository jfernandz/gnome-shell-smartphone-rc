#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/smartphone-rc@jfaparicio.github.io"
bash "$project_dir/scripts/lib/stage.sh" "$extension_dir"
echo "Installed to $extension_dir"
echo 'For the next login: gnome-extensions enable smartphone-rc@jfaparicio.github.io'
echo 'To load the latest source now without logging out: bash scripts/prepare-reload.sh'
