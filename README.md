# Smartphone Remote Control

Use a smartphone browser as a touchpad and keyboard for an unlocked GNOME desktop over the local network. No mobile app is required.

**v0.6.3 · GNOME Shell 51 · tested on 51.1, Wayland.** Chrome on Android is the initial mobile target; iOS Safari is unvalidated.

## Features

- Touchpad movement, tap for left click, hold for right click, and two-finger scrolling; a collapsible Controls panel maximizes the touch surface in portrait and landscape.
- Live typing, corrections and Enter, with desktop text-focus detection and a manual **Keyboard** fallback.
- Pointer sensitivity in half steps: default range 0.5×–10×, configurable up to 20×. Scrolling speed is independent.
- Local QR pairing over HTTPS/WSS with explicit desktop approval.
- Optional remembered browsers, expiry and immediate revocation in native Settings.
- One controlling browser at a time; locking or disabling the extension stops control.

## Install and configure

Requirements: GNOME Shell 51, GJS, GLib/GIO, libsoup 3.8+ with glib-networking for TLS, GTK 4/libadwaita for Settings, util-linux (`prlimit`), OpenSSL and iproute2. GNOME packages supply the shared desktop libraries. Source installation also needs `glib-compile-schemas`; ZIP installation uses `gnome-extensions`. Both devices must be on a network that allows communication between them; the PC may use Ethernet.

Install a built ZIP, or install from the project source:

```sh
# Choose one installation method:
gnome-extensions install --force /path/to/smartphone-rc-0.6.3.zip
# Or, from the project directory:
bash scripts/install.sh
```

Log out and back in to load the installed files, then enable the extension if needed:

```sh
gnome-extensions enable smartphone-rc@jfaparicio.github.io
```

Settings groups controls into **Network**, **Pointer**, **Security**, **Devices** and **About** tabs.

Open **Settings → Network**, select a private IPv4 address assigned to an active PC interface, choose a port (default **8844**), and press **Apply** under **Apply network configuration**. This saves a private key and a 90-day self-signed certificate under `$XDG_CONFIG_HOME/smartphone-rc/` (normally `~/.config/smartphone-rc/`). **Settings → Security** shows its SHA-256 fingerprint, expiry and verification instructions. **Renew certificate…** in Security opens Network to review the address; a new certificate is generated only when you press Apply. Setup neither starts the service nor changes the firewall.

If the address changes or the certificate expires, stop control, configure again, and restart. Failed or cancelled setup preserves the previous configuration. Starting without valid configuration offers **Open Settings**.

For development without logging out, see the separate [source reload and ZIP install workflows](scripts/README.md). Both replace this extension and stop existing remote connections.

## Connect and control

1. Choose **Start remote control** from the top-bar touchpad menu.
2. Scan the QR and open the complete link on the phone. In Lens, choose **Open in Chrome**. **Show pairing QR** and **Copy pairing link** are alternatives.
3. At the self-signed certificate warning, compare the browser certificate's SHA-256 fingerprint with **Show certificate fingerprint** on the PC before allowing an exception. Do not trust a fingerprint shown only inside the web page or disable certificate checks globally.
4. Tap **Connect**. On the PC, choose **Accept**, **Accept and remember**, or **Reject**. Approval requires acknowledging the certificate comparison. The menu also offers **Approve phone** and a remember switch.
5. Slide or tap the touchpad. Tap **•••** to open the controls card with connection, keyboard, sensitivity and sound actions. Hold one finger still on the touchpad for a right click; moving or adding another finger cancels the hold. Tap outside the panel to close it. Focus a desktop text field to request the phone keyboard; tap **Keyboard** or the editor if it stays closed. Changes stream immediately; the native Enter key sends Enter to the PC.

Invitations expire after two minutes; approval must occur within 30 seconds of connecting. Approval consumes the invitation. **New pairing QR** ends the previous connection and creates a fresh invitation. Never share pairing links publicly.

The editor shows only text entered from the phone, resets on detected field changes, and masks fields GNOME reports as sensitive. It does not mirror existing desktop text or cursor selections. Avoid editing the same field from both devices during corrections. An unacknowledged edit pauses typing after one second; refocus the PC field to resume. Pointer control remains connected.

## Reconnect and remembered browsers

Temporary approval can recover across tabs/browser restarts for up to 30 minutes of inactivity while the same service runs. Bookmark the plain PC address for recovery. Backgrounding pauses input; returning resumes or reconnects without replaying unfinished edits. Disconnect, service stop/restart, lock or disable revokes temporary approval.

**Accept and remember** authorizes that browser profile for 7, 30 or 90 days, selected in **Settings → Security** (default 90). The choice applies to new enrollments; use does not renew trust. Clearing cookies or changing browsers requires pairing again.

**Disconnect phone** preserves remembered trust. **Settings → Devices → Forget** revokes it and disconnects an affected browser immediately; **Forget all** revokes every remembered browser. Names are editable labels, not identity checks. Up to 32 browsers may be remembered, but another browser cannot take over an active connection.

After lock, login or service restart, start control manually and reopen the plain PC address in a remembered browser. There is no automatic startup, remote unlock or login-screen control. Anyone with access to an authorized browser can control the unlocked desktop while the service runs.

## Troubleshooting and limits

- **Page unavailable:** check the selected address, guest Wi-Fi/client isolation and firewall access to the configured TCP port. The extension does not configure firewall/router rules or listen on every interface.
- **Port occupied:** stop the conflicting service or select another port in Settings.
- **Missing tools:** Settings reports OpenSSL/iproute2 errors; install util-linux if startup reports missing `prlimit`.
- **Connect disabled:** an unapproved browser needs a fresh QR invitation. Browser profiles and embedded Lens windows may use separate cookie stores.
- **Typing compatibility:** focus detection and Unicode fallback depend on the application, input method and keyboard layout. Dragging, modifier shortcuts and bidirectional cursor synchronization are unsupported. The editor is limited to 65,536 UTF-16 units.
- **Version mismatch in About:** installed and session-cached versions can differ after an update; log out and back in to load the installed version normally.

The network server runs in a bounded GJS child with authenticated private D-Bus. It shares your OS identity and is not sandboxed. TLS still requires manual first-use certificate verification. See [SECURITY.md](SECURITY.md) for the trust model and [TESTING.md](TESTING.md) for actual coverage and limitations.

## Desktop sound

While connected, open the **•••** controls card to use **Volume** and **Mute/Unmute** on the phone to control
GNOME's default audio output. Changes made on the PC and output switches
are reflected on the phone. Remote adjustments are limited to 0–100%;
setting the slider to zero mutes, and raising it unmutes. Controls are
unavailable when disconnected or when there is no audio output.

## Development

Dependencies are declared here by the task that uses them. Runtime requirements
above are needed to use the extension. Development and publication tools are
installed only on developer machines or CI jobs that execute those tasks; they
are excluded from the extension ZIP. Common validation commands run both
locally and in CI with the same options. System tools use the OS package
manager, JavaScript tools use npm, and optional Python review tools use a venv
and requirements-review.txt. No per-tool download scripts are used.

No npm packages are needed at runtime. Development uses system packages plus
`npm ci --ignore-scripts` for the pinned ESLint dependencies in package-lock.json.
Node.js must be 22.13+ on 22.x, or 24+; CI tests 22 and 24. GNOME Shell 51 and
libsoup 3.8+ remain required by the native tests.

| Task | Development tools and packages |
| --- | --- |
| JavaScript lint and automated tests | Node.js/npm and the locked ESLint packages; Git, Bash, coreutils, tar and unzip, plus the runtime requirements above. The suite includes real packaging checks, so `gnome-extensions pack` and `glib-compile-schemas` are required. |
| Workflow validation | `actionlint` (tested with 1.7.12), run locally and in the CI/release test jobs with the same options. |
| Browser/accessibility tests | Chromium and fonts; CI installs `noto-fonts`. `fontconfig` provides font discovery/diagnostics. No Playwright, Puppeteer or npm browser package is used. |
| Publication screenshots and icon | The browser tools above plus ImageMagick (`magick`). The local generator uses Node, Git, tar and unzip from the base development tools. |
| Isolated GNOME/native acceptance | Python 3, D-Bus (`dbus-run-session`), GLib (`gdbus`, `gsettings`), GNOME Shell, GTK 4/libadwaita, `which` and FUSE 3 (`fusermount3` for cleanup), plus the base requirements. |
| GitHub release operations | GitHub CLI (`gh`), with repository authentication. The release runner also uses Python 3's built-in zipfile module to bundle artifacts. Neither is needed to use the extension. |
| Optional static review | Python 3/venv/pip and the pinned `shexli`, `tree-sitter` and `tree-sitter-javascript` packages in requirements-review.txt; see [SHEXLI.md](SHEXLI.md). |

Check the environment or prepare it with the single development setup script:

```sh
bash scripts/prepare-env.sh                         # Check the base tools; install nothing.
bash scripts/prepare-env.sh --install               # Install base system/npm dependencies.
bash scripts/prepare-env.sh --install --publication # Also prepare browser, icon and release tools.
```

Add `--browser`, `--native` or `--review` for those tasks; `--all` selects every
profile. `--review --install` creates/reuses .venv and installs
requirements-review.txt there. By default the script only checks; system
installation uses pacman (with sudo if needed), npm uses `ci --ignore-scripts`,
and optional review packages use the venv's pip. Run the script as your normal
user. It does not install the extension or authenticate GitHub. Details:
[scripts/README.md](scripts/README.md#prepare-the-development-environment).

For manual installation on Arch Linux, install the base tools through pacman. `actionlint`
is in extra; it is a standalone binary, not a Node/Python module. No Go compiler
or separate dependency-download script is needed:

```sh
sudo pacman -S --needed git nodejs npm actionlint bash coreutils tar unzip \
  gnome-shell gjs glib2 libsoup3 glib-networking openssl iproute2 util-linux
npm ci --ignore-scripts
npm run lint
npm run lint:actions
npm test
```

Install additional tools only for the tasks you run:

```sh
# Browser checks, publication screenshots and PNG icon generation:
sudo pacman -S --needed chromium imagemagick noto-fonts fontconfig
# Isolated native acceptance (GTK 4/libadwaita come with GNOME Shell):
sudo pacman -S --needed python dbus fuse3 which
# GitHub release operations:
sudo pacman -S --needed github-cli python
# Optional Python static review (then follow SHEXLI.md):
sudo pacman -S --needed python python-pip
```

OS package versions follow the distribution; the exact npm and Python review
packages are pinned in their lock/requirements files. CI installs the system
tools with pacman and selects Node 22/24 explicitly. `lint:actions` runs
actionlint standalone, with its optional ShellCheck and Pyflakes integrations
disabled, so unrelated local installations do not change the checks. The
publication job adds Chromium, fonts and ImageMagick; the GitHub release job
uses gh and Python. Optional native acceptance and static review remain
explicit tasks, as documented in TESTING.md and SHEXLI.md.

Build a ZIP with `bash scripts/package.sh /path/to/output`. Use a separate output
directory to preserve released artifacts. Logs: `journalctl --user -f -o cat`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow and module ownership, [scripts/README.md](scripts/README.md) for tooling, [DBUS.md](DBUS.md) for the process contract, and [TESTING.md](TESTING.md) for browser/native checks. [PLAN.md](PLAN.md), [IDEAS.md](IDEAS.md) and [PUBLICATION.md](PUBLICATION.md) track scope, proposals and distribution work; [CHANGELOG.md](CHANGELOG.md) records releases.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
