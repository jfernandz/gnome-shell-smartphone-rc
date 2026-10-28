#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
install_dependencies=false
mode_option=
browser=false
publication=false
native=false
review=false
usage() {
    cat <<'HELP'
Usage: bash scripts/prepare-env.sh [--check | --install] [profiles]

Default: check the base development environment without installing anything.
--install       Install system packages with pacman, then run npm ci.
--browser       Include Chromium and fonts for browser/accessibility tests.
--publication   Include browser tools, ImageMagick, gh and Python for releases.
--native        Include isolated GNOME/native test tools.
--review        Include the pinned optional Python review tools in .venv.
--all           Include every profile.
--help          Show this help.

Checks work on other distributions; automated system installation uses pacman.
Only pacman uses sudo when needed. npm and pip run as the invoking user.
No extension installation, desktop reload or GitHub authentication is performed.
HELP
}
for argument in "$@"; do
    case "$argument" in
        --check|--install)
            if [[ -n "$mode_option" && "$mode_option" != "$argument" ]]; then
                printf 'Choose either --check or --install.\n' >&2
                exit 2
            fi
            mode_option=$argument
            [[ "$argument" != --install ]] || install_dependencies=true
            ;;
        --browser) browser=true ;;
        --publication) publication=true; browser=true ;;
        --native) native=true ;;
        --review) review=true ;;
        --all) browser=true; publication=true; native=true; review=true ;;
        --help|-h) usage; exit 0 ;;
        *) printf 'Unknown option: %s\n' "$argument" >&2; usage >&2; exit 2 ;;
    esac
done
packages=(git nodejs npm actionlint bash coreutils tar unzip gnome-shell gjs glib2 libsoup3 glib-networking openssl iproute2 util-linux)
commands=(git node npm actionlint bash install cp mv rm mkdir mktemp tar unzip gnome-shell gjs glib-compile-schemas openssl ip prlimit)
if $browser; then
    packages+=(chromium noto-fonts fontconfig)
    commands+=("${SMARTPHONE_RC_CHROMIUM_BIN:-chromium}" fc-match fc-list)
fi
if $publication; then
    packages+=(imagemagick github-cli)
    commands+=(magick gh)
fi
if $native; then
    packages+=(dbus fuse3 which)
    commands+=(dbus-run-session gdbus gsettings fusermount3 which)
fi
if $review; then
    packages+=(python-pip)
fi
if $publication || $native || $review; then
    packages+=(python)
    commands+=(python3)
fi
if $install_dependencies; then
    command -v pacman >/dev/null || { printf 'Automatic installation requires pacman; install the README packages for your OS and rerun --check.\n' >&2; exit 1; }
    if (( EUID == 0 )); then
        pacman -S --needed "${packages[@]}"
    else
        command -v sudo >/dev/null || { printf 'sudo is required to install system packages.\n' >&2; exit 1; }
        sudo pacman -S --needed "${packages[@]}"
    fi
    (cd -- "$project_dir" && npm ci --ignore-scripts)
    if $review; then
        if [[ ! -x "$project_dir/.venv/bin/python" ]]; then
            python3 -m venv "$project_dir/.venv"
        fi
        "$project_dir/.venv/bin/python" -m pip install -r "$project_dir/requirements-review.txt"
    fi
fi
missing=0
for tool in "${commands[@]}"; do
    if command -v "$tool" >/dev/null; then
        printf 'OK: %s\n' "$tool"
    else
        printf 'MISSING: %s\n' "$tool" >&2
        missing=1
    fi
done
if (( missing )); then
    printf 'Install the missing tools, or rerun with --install on Arch Linux.\n' >&2
    exit 1
fi
if $browser && [[ "$(fc-match --format '%{family}' 'Noto Sans')" != *'Noto Sans'* ]]; then
    printf 'Missing Noto Sans fonts; install noto-fonts or rerun with --install --browser.\n' >&2
    exit 1
fi
node --input-type=module -e '
const [major, minor] = process.versions.node.split(".").map(Number);
if (!((major === 22 && minor >= 13) || major >= 24)) {
    console.error(`Unsupported Node ${process.versions.node}; need 22.13+ on 22.x, or 24+.`);
    process.exit(1);
}
console.log(`OK: Node ${process.versions.node}`);
'
if [[ ! "$(gnome-shell --version)" =~ GNOME\ Shell\ 51([.]|$) ]]; then
    printf 'GNOME Shell 51 is required by this project.\n' >&2
    exit 1
fi
gjs -c '
imports.gi.versions.Soup = "3.0";
imports.gi.versions.Gtk = "4.0";
imports.gi.versions.Adw = "1";
const {Soup, Gio, Gtk, Adw} = imports.gi;
if (Soup.get_major_version() !== 3 || Soup.get_minor_version() < 8)
    throw new Error("libsoup 3.8+ is required");
if (!Gio.TlsBackend.get_default().supports_tls())
    throw new Error("GIO TLS support is unavailable; install glib-networking");
if (!Gtk || !Adw) throw new Error("GTK 4 and libadwaita are required");
print("OK: libsoup 3.8+, GIO TLS, GTK 4 and libadwaita");
'
(cd -- "$project_dir" && npm ls --depth=0)
if $review; then
    [[ -x "$project_dir/.venv/bin/python" ]] || { printf 'Missing review venv; rerun with --install --review.\n' >&2; exit 1; }
    "$project_dir/.venv/bin/python" - "$project_dir/requirements-review.txt" <<'PY'
import sys
from importlib.metadata import version
from pathlib import Path
for requirement in Path(sys.argv[1]).read_text().splitlines():
    if not requirement.strip() or requirement.startswith('#'):
        continue
    name, expected = requirement.split('==')
    actual = version(name)
    if actual != expected:
        sys.exit(f'{name}: expected {expected}, found {actual}; rerun --install --review')
    print(f'OK: {name} {actual}')
PY
fi
printf 'Development environment ready for the selected profiles.\n'
