#!/usr/bin/env bash
set -euo pipefail
session_file="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR must be set}/smartphone-rc-session"
if [[ ! -f "$session_file" ]]; then
    echo 'Choose "Start session" in the extension menu first.' >&2
    exit 1
fi
IFS= read -r session_url < "$session_file" || [[ -n "$session_url" ]]
adb reverse tcp:8844 tcp:8844 >/dev/null
adb shell am start -a android.intent.action.VIEW -d "'$session_url'" >/dev/null
echo 'Opened the pairing page. Tap Connect, then approve the phone in the PC menu.'
