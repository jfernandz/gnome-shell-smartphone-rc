# Smartphone Remote Control

Control a GNOME desktop from a smartphone browser over the local network. The phone acts as a touchpad and keyboard, with no mobile app required.

**Status: v0.4.4 for GNOME Shell 51 (tested on 51.1, Wayland).** LAN connections use HTTPS/WSS, an expiring pairing secret, and explicit desktop approval for new browsers. Pairing uses a locally generated QR code; mobile typing is streamed live, with desktop text-focus detection; see [PLAN.md](PLAN.md).

## Features

- A top-bar menu to start, approve, reject, disconnect, and stop the service, with subtle action colors.
- Pairing notifications with Accept, Accept and remember, and Reject buttons, followed by a guided certificate check for new browsers.
- Native GNOME preferences for sensitivity limits and trusted browsers.
- An encrypted connection bound to one selected private LAN IPv4 address.
- A temporary pairing QR code, one phone at a time, and the requesting peer's IP shown on the PC.
- A dark mobile touchpad, tap to click, left/right click buttons, and two-finger scrolling.
- A Sensitivity slider (default 0.5×–10× in steps of 0.5), with configurable limits up to 20× in Settings. It remembers the chosen value in this browser; scrolling keeps its original speed.
- Live mobile typing, corrections, and deletion, with a mobile text editor and the native keyboard's Enter key.
- Desktop text-focus detection that requests the phone keyboard automatically, with a manual Keyboard fallback.
- A temporary Secure/HttpOnly/SameSite=Strict cookie that recovers approval across tabs and browser restarts, expiring after 30 minutes of inactivity.
- Optional remembered browsers with configurable 7/30/90-day trust, editable names, last-used dates, and individual/global revocation.
- Background pause and automatic reconnection for the approved browser.
- Session shutdown when the extension is disabled or the desktop locks.

## Set up local networking

Requirements: GNOME Shell 51, GJS, libsoup 3.8 or later, util-linux (`prlimit`), OpenSSL, and `iproute2`. Installation also uses `glib-compile-schemas`; ZIP packaging uses `gnome-extensions pack`. Both devices must be on a local network that allows communication between them; the PC may use Ethernet. Chrome on Android is the initial mobile browser target.

Install the extension from the project directory:

```sh
bash scripts/install.sh
```

After loading the extension, open **Settings → Network**. Select a detected private LAN IPv4 address (or enter one assigned to an active interface), keep port **8844** or choose another unprivileged port, then press **Configure**. This generates a private TLS key and a self-signed certificate valid for 90 days and saves configuration under `~/.config/smartphone-rc/` (or `$XDG_CONFIG_HOME/smartphone-rc/`). The page shows the certificate's SHA-256 fingerprint and expiry. Configuration does not start the service, modify the firewall, or install a certificate authority.

Pressing **Start remote control** before setup, or with invalid/expired certificate configuration, offers **Open Settings**. If the address changes or the certificate expires, stop remote control, configure networking again, and start it again. Compare the new certificate in the phone browser. Existing configurations remain supported; network setup and renewal are handled entirely in Settings.

To load the extension or update it **without logging out**, run:

```sh
bash scripts/prepare-reload.sh
```

Open Looking Glass with **Alt+F2**, `lg`, Enter. Paste the command printed by the script and press Enter, then close the console with Esc. For future updates, recall that same command with the Up arrow and press Enter; it builds the current project source automatically. The loader creates a fresh development build path to avoid GNOME's module cache and replaces only this extension. Existing remote sessions are stopped. Regular installation remains available for the next login:

```sh
gnome-extensions enable smartphone-rc@jfaparicio.github.io
```

## Connect the phone

The menu shows **Start remote control** while off and **Stop remote control** while running. **Reject request** and **Disconnect phone** appear only when applicable. Locking the desktop stops remote control; after unlocking, start it again from the menu.

1. Open the touchpad icon in the PC top bar and choose **Start remote control**.
2. Scan the QR code displayed by the PC and open the complete link on the phone. The QR includes the temporary pairing secret. Use **Show pairing QR** to display a pending code again, or **Copy pairing link** as an alternative. After approval, **New pairing QR** remains available in the PC menu: it ends the previous connection and generates a fresh invitation. A new browser requires approval; a browser with valid remembered trust can reconnect without it.
3. On the first visit, the browser warns that the local certificate is self-signed. Compare its SHA-256 fingerprint with **Show certificate fingerprint** in the PC menu (or Settings → Network) before allowing an exception for this address. Do not disable certificate checking globally or install a root CA.
4. Tap **Connect**, then choose **Accept**, **Accept and remember**, or **Reject** in the PC notification. Accept opens a certificate verification dialog: compare the PC fingerprint with the certificate details provided by the phone browser, acknowledge the match, then approve. Alternatively, use **Approve phone** in the menu, optionally enabling **Remember this browser** first. The displayed IP is an informational label; it does not establish device identity.
5. Move a finger over the black touchpad. Focus a desktop text field: the phone shows its editor and requests the native keyboard. Type normally; changes appear on the PC immediately. Use the native Enter key to confirm a search. If the browser does not open the keyboard, tap **Keyboard** or the mobile editor. While typing, the layout follows the visible viewport and reported keyboard bounds, keeps the editor above the keyboard, and temporarily hides the sensitivity slider and click buttons to preserve space.

Opening the bare IP address in a browser without a valid approval cookie asks you to scan the QR and keeps Connect disabled until it has a pairing secret. The link expires after two minutes. Approval must happen within 30 seconds of connecting. Refreshing before pressing Connect preserves the link in that browser tab; approval consumes it. Without remembered trust, an explicit disconnect or expired link requires a new pairing invitation. An approved browser can refresh, open a new tab, or recover after closing Chrome using its temporary cookie. Bookmark the plain PC address to reopen it without a QR while that approval remains valid.

When Chrome goes into the background, input pauses. Returning to the tab resumes the connection, or automatically reconnects if the transport was closed. Temporary approval can recover for up to 30 minutes after the last input or foreground resume; remembered browsers may establish a new session during their trust lifetime while the service is running. Reconnection resets unfinished mobile editing state rather than replaying it into a potentially changed PC field.

Choose **Disconnect phone** to end a connection or **Reject request** while approval is pending. A remembered browser can tap **Connect** again without refreshing the page. This clears temporary approval but preserves remembered trust. **Stop remote control** prevents all access until you manually start it again; use **Settings → Trusted devices → Forget** to revoke a remembered browser permanently. If scanning opens a Lens window, choose **Open in Chrome** from its menu before tapping Connect. The pending invitation remains in the URL until approval so it can be transferred to that browser tab. An embedded browser window may not appear among your normal Chrome tabs. Recovery uses a cookie shared by that browser rather than tab-only storage. Different browser engines may have separate cookie stores; use **New pairing QR** on the PC if the new browser does not have the cookie. The extension cannot recover a tab that the browser has closed.

## Settings and trusted devices

Open **Settings** from the extension menu. The **About** section reads the installed version from that extension directory and shows its license and source repository link. If GNOME still reports a different cached version for the session, About displays both versions and an update-pending explanation. Log out and back in when convenient to fully load a ZIP update. Set the sensitivity minimum and maximum in half steps, or choose **Restore defaults**. The phone slider updates during an active connection and clamps its current value to the new range. Invalid externally written ranges fall back to 0.5×–10×. Movement packets retain their independent ±500 bound.

Remembering is opt-in on the PC during approval. A remembered device represents a browser profile, not a hardware identifier: another browser or cleared cookies requires pairing again. The list provides editable names, approval/last-use/expiry dates, **Forget**, and **Forget all**. Revocation immediately disconnects an affected active browser. Names are labels, not proof of identity.

Choose 7, 30, or 90 days in **Settings → Security** for newly remembered browsers (default 90). Existing browsers keep their recorded expiry; forget and pair again to change it. Trust does not renew on use. The browser stores a separate Secure/HttpOnly/SameSite=Strict cookie; GNOME settings retain only its SHA-256 verifier and display metadata, never the raw credential. Forget and pair again to rotate the credential. Up to 32 browsers may be remembered, but only one may control the desktop at a time. Another trusted browser cannot replace an active connection belonging to a different browser.

Trust survives extension/service restarts and desktop login, but the service still requires manual startup. Desktop lock stops it; start it again from the menu after unlocking. Then open the plain PC address on the trusted browser to reconnect without a QR or approval. This grants control of an unlocked desktop to anyone with access to that authorized browser while the service is running. There is no login-screen or lock-screen control, automatic service startup, or automatic service restart after unlock in v0.4.4.

Settings reports missing OpenSSL or iproute2 with installation guidance. If starting fails because prlimit is absent, install util-linux. A port-in-use error means another service already uses that address/port: stop it or choose a different port in Settings → Network. Failed certificate generation preserves the previous configuration.

If the page cannot open, check the PC address, guest Wi-Fi/client isolation, and the PC firewall. The configured TCP port (8844 by default) must be reachable from the phone. The extension does not open router ports, configure the firewall, or listen on all interfaces.

## Security and limitations

LAN sessions require TLS; there is no unencrypted LAN fallback. HTTPS protects the page and WSS protects control events. A self-signed certificate still needs a deliberate first-use identity check: blindly accepting an unexpected certificate does not authenticate the PC. A browser trust exception is a prototype setup cost; QR-based certificate identity bootstrapping remains a design item.

Pairing uses 32 bytes from the OS random source. The secret travels in the URL fragment when opening the page, remains in the address bar until approval (to support opening the pending link in Chrome), and is sent as the first authentication message on the same-origin WebSocket over TLS, without a URL query. It is retained only in that tab's session storage until approval. Approval consumes the pairing secret. A one-use exchange valid for 30 seconds lets the server issue a host-only `__Host-smartphone_rc` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`. The cookie secret is not exposed to JavaScript or stored in Web Storage. It authorizes recovery for 30 minutes of inactivity and is revoked by explicit disconnect, server stop/restart, desktop lock, or disabling the extension. Temporary authorization lives only in server memory, so that cookie cannot recover a restarted service. The separate opt-in trust credential described above can establish a new session after the service is manually restarted. Periodic cookie refresh does not extend the server's idle deadline; input and foreground resumption do. The PC stores the pending link in a mode-0600 runtime file and removes it on approval, expiration, or stop. Never post a pairing link publicly. IP addresses are useful labels, not proof of hardware identity.

Requests must use the configured host and WebSocket origin. Control messages are validated, size limited, and rate limited, including pending connections. Only one pending or approved connection is accepted. The extension exposes only encrypted LAN connections. Automated server tests use loopback bindings internally.

The mobile editor shows text entered from this phone, not the existing contents of the PC field. It streams committed input, deletion, and autocorrection; IME composition is committed once it finishes. The field is left untouched during typing so the mobile keyboard keeps its own editing state. Large changes are split into bounded protocol messages without splitting Unicode characters. The mobile editor accepts up to 65,536 UTF-16 units per field/session before it must be cleared or reset. Changing detected fields resets the buffer; edits carry a focus context so stale edits can be discarded. Avoid moving the PC caret or editing from both devices during a mobile correction sequence: full bidirectional cursor/selection synchronization is not implemented.

Focus detection uses GNOME's input method, IBus notifications, and editable Shell text actors; support depends on the application. Browser rules may prevent automatic keyboard opening, especially on iOS, so **Keyboard** remains a fallback. The editor masks input when GNOME reports a sensitive field. Existing desktop field contents are not sent to the phone. The input backend uses surrounding-text information locally to confirm cursor and length changes; it retains only counts while synchronizing an edit.

Text insertion uses GNOME's input method when the application acknowledges text updates. Deletion uses native Backspace events, never surrounding-text deletion offsets. Edits are serialized using application acknowledgements; an unacknowledged edit pauses typing after one second while leaving pointer control connected. Click the PC text field again to resume typing. Applications without surrounding-text support use a layout-dependent virtual-keyboard fallback. Arbitrary Unicode in fallback applications, dragging, and modifier shortcuts are not promised. The user has confirmed scroll and basic typing work on their desktop. See [TESTING.md](TESTING.md) for detailed validation and remaining checks.

The libsoup server runs in a separate GJS child with private bounded IPC and resource/network limits. This isolates network-process failures from GNOME Shell; it is not an OS sandbox. See [SECURITY.md](SECURITY.md) for the trust model and limits, and [PUBLICATION.md](PUBLICATION.md) for remaining public-distribution work.

## Development

The extension coordinates sessions in `extension.js`, with dialogs in `dialogs.js`, desktop focus in `focus.js`, input injection in `input.js`, and a private-pipe network-process client in `service.js`. The child entry point is `service-worker.js`; `server.js` handles HTTP/WebSocket sessions and `network-guard.js` bounds incoming connections. Browser startup lives in `web/app.js`; `web/client.js` manages connection transitions through an explicit browser environment, with keyboard editing and gestures in their own modules. Preferences groups, including initial network configuration, live in `preferences/`.

`limits.js` defines shared sensitivity and protocol bounds. `resources.json` declares runtime files and web routes; installation and packaging stage those same files through `scripts/lib/stage.sh`. To build into a separate directory without overwriting a released artifact, run `bash scripts/package.sh /path/to/output`.

Trusted-browser enrollment snapshots remain compatible with v0.2.1. Names and last-use updates use separate per-browser settings; individual revocation is permanent for that credential, and Forget all changes the valid trust generation. Metadata updates and stale enrollment snapshots cannot undo either revocation. Settings never writes the enrollment list; only the running service enrolls browsers after explicit approval.

No npm dependencies are required. Local installation compiles the GSettings schema; the GNOME extension installer compiles it when installing a ZIP. Run automated protocol and actual GJS server tests with Node.js 22+, GJS, libsoup 3.8+, util-linux, and OpenSSL:

```sh
node --test tests/*.test.js
```

Server tests choose ephemeral loopback ports, exercise HTTP and TLS, and never import the desktop input module. To additionally verify real browser cookie flags, fresh-tab recovery, complete browser restart, and revocation, install Chromium and run:

```sh
node tests/cookie-browser.mjs
node tests/cookie-browser.mjs --trusted
node tests/cookie-browser.mjs --trusted --helper
SMARTPHONE_RC_TEST_TRUST_DAYS=7 node tests/cookie-browser.mjs --trusted --helper
```

This test uses a fresh temporary browser profile and trusts only its generated test certificate's public-key pin. It does not change your normal Chrome profile or certificate policy. The server fixture's automatic approval callback is test-only.

See [scripts/README.md](scripts/README.md) for the installation, packaging, and development entry points.

See [TESTING.md](TESTING.md) for validation evidence and remaining coverage, and [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

Logs are available with `journalctl --user -f -o cat`.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
