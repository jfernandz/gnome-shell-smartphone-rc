#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
release_version=$(gjs -c 'const [,data]=imports.gi.GLib.file_get_contents(ARGV[0]);print(JSON.parse(new TextDecoder().decode(data))["version-name"]);' "$project_dir/metadata.json")
[[ "$release_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Invalid release version' >&2; exit 1; }
bundle_dir=$(mktemp -d)
trap 'rm -rf "$bundle_dir"' EXIT
bash "$project_dir/scripts/stage.sh" "$bundle_dir/source"
file_list=$(gjs -m "$project_dir/scripts/runtime-files.js" --extra)
sources=()
while IFS= read -r source; do
    sources+=(--extra-source="$source")
done <<< "$file_list"
gnome-extensions pack --force --out-dir="$bundle_dir" "${sources[@]}" "$bundle_dir/source"
output_dir="${1:-$project_dir/dist}"
mkdir -p "$output_dir"
artifact="$output_dir/smartphone-rc-$release_version.zip"
install -m 644 "$bundle_dir/smartphone-rc@jfaparicio.github.io.shell-extension.zip" "$artifact"
echo "$artifact"
