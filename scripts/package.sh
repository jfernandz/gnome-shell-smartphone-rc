#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
release_version=$(gjs -c 'const [,data]=imports.gi.GLib.file_get_contents(ARGV[0]);print(JSON.parse(new TextDecoder().decode(data))["version-name"]);' "$project_dir/metadata.json")
[[ "$release_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Invalid release version' >&2; exit 1; }
bundle_dir=$(mktemp -d)
trap 'rm -rf "$bundle_dir"' EXIT
sources=()
for source in dialogs.js focus.js input.js network.js protocol.js server.js settings.js trusted.js LICENSE web; do
    sources+=(--extra-source="$source")
done
gnome-extensions pack --force --out-dir="$bundle_dir" "${sources[@]}" "$project_dir"
mkdir -p "$project_dir/dist"
artifact="$project_dir/dist/smartphone-rc-$release_version.zip"
install -m 644 "$bundle_dir/smartphone-rc@jfaparicio.github.io.shell-extension.zip" "$artifact"
echo "$artifact"
