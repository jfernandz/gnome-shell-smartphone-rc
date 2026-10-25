#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
target_dir="${1:?Pass a destination directory}"
file_list=$(gjs -m "$project_dir/scripts/runtime-files.js")
while IFS= read -r file; do
    install -D -m 644 "$project_dir/$file" "$target_dir/$file"
done <<< "$file_list"
glib-compile-schemas --strict "$target_dir/schemas"
