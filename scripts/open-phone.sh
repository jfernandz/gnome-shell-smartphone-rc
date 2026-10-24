#!/usr/bin/env bash
set -euo pipefail
extension_id='smartphone-rc@jfaparicio.github.io'
if ! gnome-extensions info "$extension_id" >/dev/null 2>&1; then
    echo 'GNOME has not loaded the extension. Follow the installation or hot-load steps in README.' >&2
    exit 1
fi
session_file="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR must be set}/smartphone-rc-session"
if [[ ! -f "$session_file" ]]; then
    echo 'Choose "Start Wi-Fi session" in the extension menu first.' >&2
    exit 1
fi
IFS= read -r session_url < "$session_file" || [[ -n "$session_url" ]]
origin="${session_url%%/\#*}"
case "$origin" in
    https://*)
        certificate="${XDG_CONFIG_HOME:-$HOME/.config}/smartphone-rc/certificate.pem"
        if ! curl --cacert "$certificate" --fail --silent --max-time 3 "$origin/" >/dev/null; then
            echo 'The Wi-Fi server is not reachable or its certificate does not match. Start a new session; rerun network setup if the PC address changed.' >&2
            exit 1
        fi
        ;;
    *)
        echo 'Invalid pairing link. Start a new session in the PC menu.' >&2
        exit 1
        ;;
esac
adb shell am start -a android.intent.action.VIEW -d "'$session_url'" >/dev/null
echo 'Opened the pairing page. Tap Connect, then approve the phone in the PC menu.'
