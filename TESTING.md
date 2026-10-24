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
