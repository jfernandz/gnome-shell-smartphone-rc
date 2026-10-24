# Validation record

## Environment

Validated on 2026-10-24 using GNOME Shell / Mutter 51.1 on Wayland, GJS 1.90.1, libsoup 3, and Node.js 26.12.0. The USB-connected Android phone was an RMX3943 running Android 16 and Chrome 156.0.8078.47.

## Automated checks

`node --test tests/*.test.js`: four tests passed.

- Rejects malformed, oversized, non-finite, and unsupported input messages.
- Accepts bounded motion and Unicode text while ignoring extra properties.
- Enforces a per-connection input rate budget.
- Runs the actual GJS/libsoup server and checks HTTP responses, origin rejection, invalid pairing, ignored input before approval, accepted input after approval, invalid-message disconnection, and revoked-token replay rejection.

The integration test uses loopback port 8844; stop the extension's session before running it. Its test-only approval callback never imports the desktop input module.

Shell scripts passed `bash -n`; mobile JavaScript passed `node --check`.

## Desktop and phone integration

Used an isolated headless GNOME Shell compositor with a 1280×720 virtual monitor and a separate D-Bus session/settings directory. A temporary test-only extension enabled evaluation in that isolated compositor; the normal desktop's evaluation policy was not changed. That driver is not part of the extension or installer.

Chrome on the actual phone loaded the page through ADB reverse forwarding. Chrome DevTools drove Connect, touch events, text submission, and click controls. The isolated desktop exercised the same extension start/approve/stop methods used by the menu.

Observed results:

- The phone displayed pending approval, then Connected after desktop approval.
- A phone-browser movement of (+80, +40) moved the compositor pointer by (+80, +40).
- Sending `Hello España` inserted the complete text into a focused GNOME Shell text entry through the input method.
- Backspace changed the text to `Hello Españ`.
- Left and right click controls produced button 1 and button 3 press events.
- Stopping closed the browser connection and removed the private pairing file, whose mode was 0600.
- Disable/re-enable followed by starting a fresh session worked. Disabling closed the listening port.

## Remaining validation

- Two-finger scrolling is implemented, but its effective desktop scroll result was not confirmed in the headless test. Test against an application with scrollable content.
- Verify real finger ergonomics, sensitivity, keyboard resizing, and gesture cancellation interactively.
- Verify text in ordinary Wayland applications, terminals, and Xwayland clients. The input-method path worked in the Shell entry; raw-key fallback dropped `ñ` with the isolated compositor's default layout.
- Verify other special keys, arbitrary Unicode, emoji, composition, autocorrection, and replacement behavior.
- Verify lock/unlock, suspend/resume, multiple monitors, scaling, pending-session expiration, and long sessions.
- Test QR pairing, Wi-Fi/firewall behavior, and encryption when implemented.
- iOS Safari has not been tested.

This validates the initial input and pairing prototype. It does not establish completion of the Wi-Fi MVP or readiness for publication.

## Wi-Fi implementation

Validated on the same hardware using the PC's private LAN address `192.168.1.147` and phone address `192.168.1.149`:

- The GJS server bound only to the selected LAN address, with HTTPS enabled. The existing loopback development server could remain separate.
- Chrome loaded the page over HTTPS after accepting the expected local self-signed certificate warning. No global certificate-checking bypass was used.
- The page reported a secure context. Its connection used WSS, and the server recorded the phone's actual LAN IP rather than loopback.
- Reloading the page before connecting retained the pending pairing secret.
- Desktop approval changed the phone's state to Connected and removed the token from tab storage.
- A phone-browser movement of (+60, +30) moved the isolated compositor pointer by (+60, +30).
- The Unicode text payload `Wi-Fi España` reached the desktop input callback intact. This network check did not establish insertion in an ordinary application; the earlier Shell-entry test covers that input path separately.
- Stopping the desktop session disconnected the browser.
- The extension computed the same certificate fingerprint as OpenSSL.
- A fresh-path reload replaced the extension in the isolated Shell without restarting that compositor.

The phone URL used the PC's LAN IP, not an ADB-reversed address. ADB was used to launch/debug Chrome; control traffic used the network. USB was still physically attached for debugging during these automated hardware checks.

`node --test tests/*.test.js`: all seven tests passed for the Wi-Fi implementation. Automated coverage now includes both HTTP and TLS server runs with ephemeral ports, rejection of an unexpected Host header, certificate validation using an explicitly trusted test certificate, and failure when the self-signed test certificate is not trusted. LAN address validation rejects public, wildcard, loopback, malformed, and noncanonical addresses for network configuration.

Pending: test without the debug cable attached, ordinary application input, long sessions, firewall failure UX, address changes, and browser behavior when renewing the certificate. QR pairing is not implemented yet.


## Wi-Fi pairing UX correction

- Removed the local test session from the extension menu and the phone-opening helper. Loopback server support remains confined to the automated test harness.
- Added a native GNOME pairing QR dialog that opens when a Wi-Fi session starts. It carries the complete HTTPS URL including the secret fragment, and closes on a connection request, expiration, stop, or disable.
- Rendered the dialog in an isolated GNOME 51.1 compositor and decoded a screenshot with ZBar. The decoded value exactly matched the synthetic full pairing URL, including its 64-character secret. The QR is generated locally, without an external service or bundled QR library.
- Added four browser-state regression tests: visiting the bare address, refreshing a scanned link, consuming the token on approval/disconnection, and browsers that deny session storage.
- All eleven automated tests pass. Scanning the new dialog with the physical phone remains an interactive validation step; the phone was disconnected from ADB during this change.

## Reusable development reload

The fixed Looking Glass command imports `scripts/reload.js` and calls its reload function. Each invocation asynchronously runs the builder before unloading this extension, then loads the fresh snapshot. Two consecutive calls in an isolated GNOME 51.1 session loaded different build paths and left the extension ACTIVE. The project source is reread on every call; no terminal command is needed between edits.


## Live typing and desktop focus

The user confirmed scrolling and the previous text input worked on their actual desktop. The live-typing update removes Send and the auxiliary Enter/Tab/Escape/Backspace toolbar. Native mobile input events now produce bounded replacement edits, and the native Enter key produces a desktop Enter event. Only recent phone-entered text is reflected; existing desktop contents are not read.

All seventeen automated tests pass, including live corrections, Unicode deletion counts, deferred IME composition, native Enter, empty-buffer Backspace, focus transitions, sensitive-field masking, and bounded edit validation.

In an isolated GNOME 51.1 compositor, a real GTK 4 application exposed text focus through the new monitor. Input-method edits inserted `helo España`, replaced the suffix to produce `hello España`, and deleted the final character to produce `hello Españ`. Typing did not change the focus context. Moving to a password entry produced a sensitive focus update; leaving text input produced an inactive update.

The phone was not attached to ADB for this update. Actual native mobile keyboard opening and physical Gboard autocorrection still need interactive validation. The simulated browser tests check the API requests and message behavior, not the OS keyboard appearing. Xwayland/application compatibility and simultaneous PC/mobile caret editing remain limitations.

## Pre-commit refactor

The user subsequently confirmed automatic keyboard opening and live typing from their Android phone. Before committing, the implementation was reorganized without changing that workflow:

- Extension session-state and input callbacks became named methods.
- QR and certificate dialogs moved to `dialogs.js`, with shared lifecycle cleanup.
- Browser connection orchestration remains in `web/app.js`; keyboard and pointer interactions moved to `web/keyboard.js` and `web/touchpad.js`.
- Retired batch-text messages and auxiliary key commands were removed. Live edits and Enter require a focus context.
- Disconnect now clears pending gesture state and cancels a queued animation frame.

All twenty automated tests passed, including pointer movement, tap, scrolling, gesture cancellation, and serving the browser modules over HTTP/TLS. A fresh isolated GNOME 51.1 session loaded the refactored extension, rendered a QR that decoded to the expected complete synthetic pairing URL, opened the certificate dialog, and completed disable/re-enable with ACTIVE status. The user's running desktop session was not reloaded during verification.
