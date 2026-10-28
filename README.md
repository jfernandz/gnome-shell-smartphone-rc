# Smartphone Remote Control

Use a smartphone browser as a touchpad and keyboard for an unlocked GNOME desktop over the local network. No mobile app is required.

**v0.8.0 · GNOME Shell 51 · tested on 51.1/Wayland.** Chrome on Android is the initial mobile target; iOS Safari is unvalidated.

## Features

- Touchpad movement, tap for left click, hold for right click and two-finger scrolling.
- A floating **•••** button opens keyboard, connection, sensitivity and sound controls; the closed card leaves maximum touchpad space.
- Live typing and corrections, with desktop text-focus detection and a manual **Keyboard** fallback.
- Pointer sensitivity in half steps: default 0.5×–10×, configurable up to 20×; independent scrolling speed.
- Default-output volume/mute controls, synchronized with the PC and limited to 0–100%.
- HTTPS/WSS QR pairing with desktop approval and optional remembered browsers.
- One controlling browser; lock, Stop or disabling the extension ends control.
- Lock/suspend the PC from the controls card with confirmation.
- Optional automatic stop timer, configured locally and disabled by default.

## Install and configure

Requires GNOME Shell 51, GJS, GLib/GIO, libsoup 3.8+, glib-networking, GTK 4/libadwaita, util-linux (`prlimit`), OpenSSL and iproute2. GNOME supplies the shared desktop libraries. Source installation uses `glib-compile-schemas`; ZIP installation uses `gnome-extensions`.

Both devices must be on a network that permits communication. The PC may use Ethernet. Install a built ZIP or install from source:

```sh
# Choose one:
gnome-extensions install --force /path/to/smartphone-rc-0.8.0.zip
bash scripts/install.sh
```

Log out and back in, then enable if needed:

```sh
gnome-extensions enable smartphone-rc@jfaparicio.github.io
```

In **Settings → Network**, choose an active private IPv4 address and port (default **8844**), then press **Apply**. This creates a private key and 90-day self-signed certificate under `$XDG_CONFIG_HOME/smartphone-rc/` (normally `~/.config/smartphone-rc/`). It neither starts control nor changes the firewall. Failed or cancelled setup preserves the previous configuration.

**Settings → Security** shows the certificate fingerprint and expiry. **Renew certificate…** opens Network; renewal occurs only after Apply. If the address changes or the certificate expires, stop control, configure again and restart.

For development updates without logging out, see the [source and ZIP reload workflows](scripts/README.md). Both stop existing remote connections.

## Connect and control

1. Choose **Start remote control** from the top-bar touchpad menu.
2. Scan the QR and open the complete link in Chrome. In Lens, choose **Open in Chrome**. The desktop menu also provides **Show pairing QR** and **Copy pairing link**.
3. At the certificate warning, compare the browser certificate's SHA-256 fingerprint with **Show certificate fingerprint** on the PC before allowing an exception. Do not trust a fingerprint shown only inside the web page or disable certificate checks globally.
4. On the phone, open **••• → Connect**. On the PC, acknowledge the certificate comparison and choose **Accept**, **Accept and remember** or **Reject**.
5. Slide to move, tap to click, hold still for a right click, or use two fingers to scroll. Moving or adding a finger cancels the hold. Tap **•••** for controls and tap outside the card to close it.

Focus a desktop text field to request the phone keyboard. If it stays closed, use **••• → Keyboard** or tap the editor. Changes stream immediately; Enter sends Enter to the PC.

The editor shows only text entered from the phone, resets on detected field changes and masks fields GNOME reports as sensitive. It does not mirror existing desktop text or cursor selections. Avoid editing the same field from both devices during corrections. An unacknowledged edit pauses typing after one second; refocus the PC field to resume. Pointer control remains connected.

Volume and mute affect GNOME's default audio output. Setting volume to zero mutes; raising it unmutes. Controls are disabled when disconnected or no output is available. Desktop changes and output switches are reflected on the phone.

## Lock and suspend

Open **••• → Lock PC** or **Suspend PC** and confirm on the phone. Cancelling
the confirmation leaves the connection unchanged. A confirmed request stops
remote control and discards unfinished input before performing the action.

Suspension requires a lockable GNOME session, systemd-logind support and
permission without an additional authentication prompt. Application/system
inhibitors are respected. The desktop must actually lock before sleep is
requested. If a check or action fails, a PC notification explains it and
control stays stopped.

Unlock/resume and start remote control locally, then reopen the phone page.
These actions never unlock, wake the PC or restart control automatically.

## Automatic stop

In **Settings → Security → Automatic stop**, enable the timer and choose
1–1440 minutes (default 30). The PC stays on. Settings apply at the next
successful service start.

The timer counts total service running time, including waiting for a phone,
disconnection and background pauses. The desktop menu shows the remaining
time and offers **Add 15 minutes** (up to 24 hours remaining) or **Cancel
automatic stop** for this run. Cancelling does not change the next-start setting.

Expiry performs the normal **Stop** cleanup, disconnects browsers and revokes
temporary approval. Remembered trust is preserved. Starting control again is
always a local action.

## Reconnect and remembered browsers

Invitations expire after two minutes; approval is required within 30 seconds of connecting. Approval consumes the invitation. **New pairing QR** ends the old connection. Never share pairing links publicly.

Temporary approval can recover across tabs/browser restarts for 30 minutes of inactivity while the same service runs. Bookmark the plain PC address. Backgrounding pauses input; returning resumes or reconnects without replaying unfinished edits. Disconnect, service stop/restart, lock or disable revokes temporary approval.

**Accept and remember** trusts that browser profile for 7, 30 or 90 days, selected in **Settings → Security** (default 90). Use does not renew trust. Clearing cookies or changing browsers requires pairing again. Up to 32 browsers can be remembered; another browser cannot take over an active connection.

**Disconnect phone** preserves remembered trust. **Settings → Devices → Forget** revokes it and immediately disconnects that browser; **Forget all** revokes every browser. Names are labels, not identity checks.

After lock, login or service restart, start control manually and reopen the plain PC address on the phone. There is no automatic startup, remote unlock or login-screen control. Anyone with access to an authorized browser can control the unlocked desktop while the service runs.

## Troubleshooting and limits

- **Page unavailable:** check the selected address, network isolation and firewall access to the configured TCP port. The extension does not configure firewall/router rules or listen on all interfaces.
- **Port occupied or certificate expired:** stop control, review Network settings, Apply and restart.
- **Missing tools:** install the dependencies listed above; Network reports OpenSSL/iproute2 errors and startup requires `prlimit`.
- **Connect disabled:** an unapproved browser needs a fresh QR. Browser profiles and embedded Lens windows may use separate cookie stores.
- **Typing:** compatibility depends on the application, input method and layout. Dragging, modifier shortcuts and bidirectional cursor synchronization are unsupported. The editor is limited to 65,536 UTF-16 units.
- **Version mismatch in About:** installed and session-cached versions can differ; log out and back in to load an update normally.

The server runs as a bounded GJS child under your OS identity; it is not sandboxed. TLS requires manual first-use certificate verification. See [SECURITY.md](SECURITY.md) and [TESTING.md](TESTING.md) for boundaries and coverage. Logs: `journalctl --user -f -o cat`.

## Development

Dependencies are installed only where their tasks run; development tools are excluded from the extension ZIP. System tools use the OS package manager, JavaScript tools use npm, and optional Python review tools use a venv. Common validation uses the same options locally and in CI.

| Task | Dependencies beyond the runtime requirements |
| --- | --- |
| Lint/tests/packaging | Node.js 22.13+ on 22.x or 24+, npm, Git, Bash, coreutils, tar, unzip, actionlint (tested with 1.7.12); locked ESLint packages from npm ci. Packaging tests use gnome-extensions and glib-compile-schemas. |
| Browser checks | Chromium, noto-fonts and fontconfig. No npm browser framework. |
| Publication | Browser tools, ImageMagick; GitHub operations additionally use gh and Python 3's built-in zipfile module. |
| Isolated native tests | Python 3, D-Bus, GLib tools, which and FUSE 3 for cleanup; GTK 4/libadwaita come with GNOME. |
| Optional static review | Python 3/venv/pip and the pinned requirements-review.txt packages; see [SHEXLI.md](SHEXLI.md). |

```sh
bash scripts/prepare-env.sh                 # Check only.
bash scripts/prepare-env.sh --install       # Install base dependencies on Arch Linux.
# Add --browser, --publication, --native, --review or --all as needed.
npm run lint
npm run lint:actions
npm test
```

Run setup as your normal user; only pacman elevates via sudo. It uses `npm ci --ignore-scripts` and an optional review venv. For manual installation on other systems, use the dependency table. Actionlint's optional ShellCheck/Pyflakes integrations are disabled consistently. CI tests Node 22/24; OS packages follow the distribution. See [script details](scripts/README.md#prepare-the-development-environment).

Build with `bash scripts/package.sh /path/to/output`. Use a new output directory to preserve released ZIPs.

[Contributing](CONTRIBUTING.md) · [Scripts](scripts/README.md) · [Tests](TESTING.md) · [D-Bus](DBUS.md) · [Scope](PLAN.md) · [Ideas](IDEAS.md) · [Publication](PUBLICATION.md) · [Changelog](CHANGELOG.md)

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
