# Smartphone Remote Control

Control a GNOME desktop from a smartphone browser over the local Wi-Fi network. The phone acts as a touchpad and keyboard, with no mobile app required.

**Status: v0.1.0 for GNOME Shell 51 (tested on 51.1, Wayland).** Wi-Fi connections use HTTPS/WSS, an expiring pairing secret, and explicit desktop approval. Pairing uses a locally generated QR code; mobile typing is streamed live, with desktop text-focus detection; see [PLAN.md](PLAN.md).

## Features

- A top-bar menu to start, approve, reject, and stop sessions.
- An encrypted connection bound to one selected private LAN IPv4 address.
- A temporary pairing QR code, one phone at a time, and the requesting peer's IP shown on the PC.
- A dark mobile touchpad, tap to click, left/right click buttons, and two-finger scrolling.
- A Sensitivity slider (0.5×–10× in steps of 0.5) that adjusts pointer speed and remembers the value in this browser; scrolling keeps its original speed.
- Live mobile typing, corrections, and deletion, with a mobile text editor and the native keyboard's Enter key.
- Desktop text-focus detection that requests the phone keyboard automatically, with a manual Keyboard fallback.
- A temporary Secure/HttpOnly/SameSite=Strict cookie that recovers approval across tabs and browser restarts, expiring after 30 minutes of inactivity.
- Background pause and automatic reconnection for the approved browser.
- Session shutdown when the extension is disabled or the desktop locks.

## Set up Wi-Fi

Requirements: GNOME Shell 51, GJS, libsoup 3, OpenSSL, and `iproute2`. Both devices must be on a local network that allows communication between them; the PC may use Ethernet. Chrome on Android is the initial mobile browser target.

Run the one-time network setup from the project directory:

```sh
bash scripts/setup-network.sh
# Or choose a specific LAN address:
# bash scripts/setup-network.sh 192.168.1.147
bash scripts/install.sh
```

Setup selects the PC's default-route address, creates a private TLS key and a self-signed certificate valid for 90 days, and saves configuration under `~/.config/smartphone-rc/`. It prints the certificate's SHA-256 fingerprint. If the address changes or the certificate expires, run setup again and start a fresh session. Setup does not modify the firewall or install a certificate authority.

To load the extension or update it **without logging out**, run:

```sh
bash scripts/prepare-reload.sh
```

Open Looking Glass with **Alt+F2**, `lg`, Enter. Paste the command printed by the script and press Enter, then close the console with Esc. For future updates, recall that same command with the Up arrow and press Enter; it builds the current project source automatically. The loader creates a fresh development build path to avoid GNOME's module cache and replaces only this extension. Existing remote sessions are stopped. Regular installation remains available for the next login:

```sh
gnome-extensions enable smartphone-rc@jfaparicio.github.io
```

## Connect the phone

1. Open the touchpad icon in the PC top bar and choose **Start Wi-Fi session**.
2. Scan the QR code displayed by the PC and open the complete link on the phone. The QR includes the temporary pairing secret. Use **Show pairing QR** to display a pending code again, or **Copy pairing link** as an alternative. After approval, **New pairing QR** remains available in the PC menu: it ends the previous connection and generates a fresh invitation requiring approval.
3. On the first visit, the browser warns that the local certificate is self-signed. Compare its SHA-256 fingerprint with **Show certificate fingerprint** in the PC menu (or the setup output) before allowing an exception for this address. Do not disable certificate checking globally or install a root CA.
4. Tap **Connect**, then choose **Approve phone** on the PC. Check that the requesting IP matches the phone.
5. Move a finger over the black touchpad. Focus a desktop text field: the phone shows its editor and requests the native keyboard. Type normally; changes appear on the PC immediately. Use the native Enter key to confirm a search. If the browser does not open the keyboard, tap **Keyboard** or the mobile editor. While typing, the layout follows the visible viewport and reported keyboard bounds, keeps the editor above the keyboard, and temporarily hides the sensitivity slider and click buttons to preserve space.

Opening the bare IP address in a browser without a valid approval cookie asks you to scan the QR and keeps Connect disabled until it has a pairing secret. The link expires after two minutes. Approval must happen within 30 seconds of connecting. Refreshing before pressing Connect preserves the link in that browser tab; approval consumes it. After an explicit disconnect or an expired link, start a new session and open its new link. An approved browser can refresh, open a new tab, or recover after closing Chrome using its temporary cookie. Bookmark the plain PC address to reopen it without a QR while that approval remains valid.

When Chrome goes into the background, input pauses. Returning to the tab resumes the connection, or automatically reconnects if the transport was closed. The approved browser can recover for up to 30 minutes after its last input or foreground resume. Reconnection resets unfinished mobile editing state rather than replaying it into a potentially changed PC field.

Choose **Stop / reject connection** to revoke access. If scanning opens a Lens window, choose **Open in Chrome** from its menu before tapping Connect. The pending invitation remains in the URL until approval so it can be transferred to that browser tab. An embedded browser window may not appear among your normal Chrome tabs. Recovery uses a cookie shared by that browser rather than tab-only storage. Different browser engines may have separate cookie stores; use **New pairing QR** on the PC if the new browser does not have the cookie. The extension cannot recover a tab that the browser has closed.

The phone needs no cable during a Wi-Fi session.

If the page cannot open, check the PC address, guest Wi-Fi/client isolation, and the PC firewall. TCP port 8844 must be reachable from the phone. The extension does not open router ports, configure the firewall, or listen on all interfaces.

## Security and limitations

LAN sessions require TLS; there is no unencrypted LAN fallback. HTTPS protects the page and WSS protects control events. A self-signed certificate still needs a deliberate first-use identity check: blindly accepting an unexpected certificate does not authenticate the PC. A browser trust exception is a prototype setup cost; QR-based certificate identity bootstrapping remains a design item.

Pairing uses 32 bytes from the OS random source. The secret travels in the URL fragment when opening the page, remains in the address bar until approval (to support opening the pending link in Chrome), and is sent to the same-origin WebSocket over TLS. It is retained only in that tab's session storage until approval. Approval consumes the pairing secret. A one-use exchange valid for 30 seconds lets the server issue a host-only `__Host-smartphone_rc` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`. The cookie secret is not exposed to JavaScript or stored in Web Storage. It authorizes recovery for 30 minutes of inactivity and is revoked by explicit disconnect, server stop/restart, desktop lock, or disabling the extension. Authorization lives only in server memory, so an old cookie cannot recover a restarted service. Periodic cookie refresh does not extend the server's idle deadline; input and foreground resumption do. The PC stores the pending link in a mode-0600 runtime file and removes it on approval, expiration, or stop. Never post a pairing link publicly. IP addresses are useful labels, not proof of hardware identity.

Requests must use the configured host and WebSocket origin. Control messages are validated, size limited, and rate limited, including pending connections. Only one pending or approved connection is accepted. The extension exposes only the encrypted Wi-Fi flow. Automated server tests use loopback bindings internally.

The mobile editor shows text entered from this phone, not the existing contents of the PC field. It streams committed input, deletion, and autocorrection; IME composition is committed once it finishes. The field is left untouched during typing so the mobile keyboard keeps its own editing state. Large changes are split into bounded protocol messages without splitting Unicode characters. The mobile editor accepts up to 65,536 UTF-16 units per field/session before it must be cleared or reset. Changing detected fields resets the buffer; edits carry a focus context so stale edits can be discarded. Avoid moving the PC caret or editing from both devices during a mobile correction sequence: full bidirectional cursor/selection synchronization is not implemented.

Focus detection uses GNOME's input method, IBus notifications, and editable Shell text actors; support depends on the application. Browser rules may prevent automatic keyboard opening, especially on iOS, so **Keyboard** remains a fallback. The editor masks input when GNOME reports a sensitive field. Existing desktop field contents are not sent to the phone. The input backend uses surrounding-text information locally to confirm cursor and length changes; it retains only counts while synchronizing an edit.

Text insertion uses GNOME's input method when the application acknowledges text updates. Deletion uses native Backspace events, never surrounding-text deletion offsets. Edits are serialized using application acknowledgements; an unacknowledged edit pauses typing after one second while leaving pointer control connected. Click the PC text field again to resume typing. Applications without surrounding-text support use a layout-dependent virtual-keyboard fallback. Arbitrary Unicode in fallback applications, dragging, and modifier shortcuts are not promised. The user has confirmed scroll and basic typing work on their desktop. See [TESTING.md](TESTING.md) for detailed validation and remaining checks.

The small libsoup server currently runs in the Shell process. Process isolation and adversarial resource-exhaustion testing remain work before a public release. This is not yet ready for extensions.gnome.org.

## Development

The extension coordinates sessions in `extension.js`, with dialogs in `dialogs.js`, desktop focus in `focus.js`, input injection in `input.js`, and the transport in `server.js`. The browser separates connection handling (`web/app.js`), keyboard editing (`web/keyboard.js`), and gestures (`web/touchpad.js`).

No npm dependencies or build step are required. Run automated protocol and actual GJS server tests with Node.js 22+, GJS, libsoup 3, and OpenSSL:

```sh
node --test tests/*.test.js
```

Server tests choose ephemeral loopback ports, exercise HTTP and TLS, and never import the desktop input module. To additionally verify real browser cookie flags, fresh-tab recovery, complete browser restart, and revocation, install Chromium and run:

```sh
node tests/cookie-browser.mjs
```

This test uses a fresh temporary browser profile and trusts only its generated test certificate's public-key pin. It does not change your normal Chrome profile or certificate policy. The server fixture's automatic approval callback is test-only.

With `adb` and `curl` installed and an authorized Android device attached, this helper opens the current pairing link:

```sh
bash scripts/open-phone.sh
```

For HTTPS links, ADB only launches Chrome; the page and control events travel over the LAN. You can unplug the cable after opening the link. The helper verifies the local server against the configured certificate before opening the page.

Logs are available with `journalctl --user -f -o cat`.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
