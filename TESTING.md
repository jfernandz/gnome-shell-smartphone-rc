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

## QR alignment and pointer sensitivity

The pairing QR now uses explicit horizontal centering. In an isolated GNOME session, a forced 400-pixel content layout gave equal 60-pixel margins around the 280-pixel QR. A screenshot of the normal layout also decoded to the expected complete synthetic pairing URL.

The mobile Sensitivity slider ranges from 0.25× to 3×, defaults to 1×, and persists in origin-local browser storage. It scales pointer movement without changing two-finger scroll speed. Invalid saved values fall back to 1×; blocked storage does not prevent adjustment for the current page. All twenty-two automated tests pass.


## Session crash investigation — 2026-10-24

The user reported a GNOME session crash while selecting sensitivity 2.85. The real desktop's coredump (PID 3867, 23:44:14 Europe/Madrid) recorded SIGSEGV in `g_utf8_offset_to_pointer`, called from Mutter's input-focus event processing. The journal also contained `meta_wayland_text_input_focus_delete_surrounding: assertion 'before >= start' failed`. This points to text deletion rather than establishing that the sensitivity multiplier caused the crash. The exact original interaction has not been reproduced.

The [Mutter 51.1 implementation](https://github.com/GNOME/mutter/blob/51.1/src/wayland/meta-wayland-text-input.c) converts negative character offsets before checking their bounds. The extension previously called `delete_surrounding` with a removal count derived from the phone's recent-text buffer, which can be stale relative to the actual desktop cursor. That call has now been removed entirely.

The mitigation forwards native Backspace events and serializes edits using the application's surrounding-text acknowledgements. This avoids computing deletion offsets in Mutter. Only cursor/length counts are retained locally; desktop text is not sent to the phone. Focus changes and shutdown discard queued edits; stalled acknowledgement or an excessive queue stops the session. Clients without acknowledgement data use the virtual-keyboard fallback.

Verification used a separate headless compositor and a real GTK 4 application, never the user's running desktop:

- Deleting 512 characters at the beginning of a populated field and inserting text completed without a crash or an out-of-bounds warning.
- A correction from `helo España` to `hello España`, followed by deletion to `hello Españ`, kept its order and Unicode characters.
- Forty queued edits completed with focus-change cancellation enabled.
- One hundred fractional pointer moves at 2.85/1.425 completed without a compositor failure.
- All twenty-seven automated tests passed. Added regression coverage verifies cursor-zero deletion, application acknowledgement ordering, cancellation, timeout cleanup, and the 2.85 sensitivity path. Tests make the unsafe deletion API throw if called.

The extension was temporarily disabled on the user's desktop while investigating. The original crash trigger and compatibility with every application remain unverified; these results establish the mitigation and tested paths, not a general guarantee against compositor bugs.


## Higher sensitivity and mobile keyboard layout — 2026-10-25

The sensitivity range now extends to 10× while preserving existing saved values and the server's ±500 per-message movement bound. Two-finger scroll speed remains independent.

The browser layout follows VisualViewport resize/scroll events and VirtualKeyboard geometry changes. During typing, the pad may shrink, secondary controls are hidden, and the editor has 24 pixels of bottom clearance. The layout uses the smaller of the reported visual viewport and the keyboard's top edge; see the [Chrome keyboard geometry documentation](https://developer.chrome.com/docs/web-platform/virtual-keyboard).

All twenty-nine automated tests passed. A separate headless Chromium instance at 360-pixel width kept the editor fully visible at viewport heights 709, 400, 280, and 220 pixels, with a measured 24-pixel gap below the editor in each case. Automated geometry tests also cover a keyboard rectangle beginning above the visual viewport's bottom. Actual SwiftKey toolbar behavior on the phone remains an interactive check; the headless browser did not emulate SwiftKey itself.


## Long-text duplication — 2026-10-25

A regression test reproduced duplication when the old mobile editor crossed its 128-character rolling-buffer limit: the code rewrote the field to its suffix after composition ended, then a subsequent final-input event carrying the original full value generated a second replacement. The simulated PC accumulated a repeated prefix and partial words.

The fix keeps the DOM value and selection intact during typing and retains the complete phone-entered value until Enter or a detected focus change. The editor limit is 65,536 UTF-16 units; outgoing removals and insertions are split into messages bounded by 512, preserving Unicode character boundaries. Protocol limits and desktop deletion safety are unchanged.

All thirty-one automated tests passed. The regression checks both a long IME commit followed by a final-input event and large Unicode pastes/replacements/deletions, confirming no repeated text and valid bounded messages. This reproduces and fixes a concrete event sequence; the user's exact SwiftKey event trace has not been captured.


## Sensitivity steps and typing-pause recovery — 2026-10-25

The user clarified that a subsequent "session drop" disconnected only the phone. The desktop journal at 00:22:28 recorded the keyboard acknowledgement timeout, and no newer GNOME Shell coredump was present. This was the extension's full-session stop on a text-input timeout, not another confirmed compositor crash.

Sensitivity now ranges from 0.5× to 10× in steps of 0.5. Existing fractional preferences are rounded to the nearest supported half step.

A text-input acknowledgement timeout or keyboard queue overflow now pauses only keyboard input. Pending edits are discarded, the web displays a recovery instruction, and pointer control stays connected. Clicking a PC field produces a new focus context, clears the phone editor, and resumes typing. The acknowledgement requirement remains in place; the cause of the missing application acknowledgement is not established by this change.

All thirty-four automated tests pass, including half-step preference migration, pointer availability while typing is paused, and resuming after a new focus context.


## Chrome backgrounding and transport recovery — 2026-10-25

The user reported another mobile disconnection when leaving Chrome. The prior implementation revoked authorization on every socket closure and had no browser-background recovery. The exact phone close code was not captured, so the original trigger is not proven.

The approved browser now receives a separate random reconnection credential stored only in tab session storage (or page memory when storage is unavailable). Unexpected transport loss reserves that session for two minutes. Successful transport recovery rotates the credential; a stale, expired, or revoked credential is rejected. Explicit phone/PC disconnect, server stop/restart, lock, and extension disable revoke it. The pairing QR secret remains one-use and does not become a reusable credential.

A hidden page suspends remote input and does not run retry timers. Returning resumes an open connection or reconnects with bounded backoff. A foreground probe replaces a stale socket that fails to acknowledge resume. Previous socket callbacks cannot overwrite the current connection, and a late resume acknowledgement cannot re-enable input on a hidden page. Pending gestures and unfinished editing state are cleared rather than replayed. The PC records a transport-interruption diagnostic without logging credentials or typed text.

Automated checks cover background/foreground transitions, stale sockets, credential rotation, invalidated-credential replay, expiry, explicit revocation, and ignored input while suspended. Server checks use actual GJS/libsoup connections over both HTTP and TLS; their recovery window is shortened to two seconds. An isolated GNOME compositor also completed connected → suspended → connected → reconnecting → stopped transitions with focus-monitor cleanup. Physical Chrome suspension/discard behavior remains an interactive test.

The final recovery checks passed all thirty-eight automated tests. Native server tests additionally verified expiry of the recovery window and revocation after the phone explicitly disconnects. Connection establishment has a bounded timeout, and returning from background replaces a transport that is already closing or fails the resume probe. Actual Chrome-on-phone suspension remains unverified for this update.

## Lost tab and pairing QR recovery — 2026-10-25

The user confirmed that scanning sometimes opens normal Chrome and sometimes opens content through Lens. No device was attached to ADB, so the cause of Chrome/window closure could not be diagnosed. An embedded browser window is a plausible explanation for a page missing from Chrome's ordinary tabs; see the [Chrome Custom Tabs overview](https://developer.chrome.com/docs/android/custom-tabs). This remains an inference about the user's Lens route, not a captured crash diagnosis.

The PC menu now keeps **New pairing QR** available after approval and during suspended/reconnecting states. It explicitly starts a fresh invitation, revokes the previous connection, and requires approval again. **Show pairing QR** continues to display an unconsumed pending invitation. A native isolated GNOME check verified that the recovery action is visible after connection and produces a different pairing link.

A pending invitation's fragment now remains in the URL until approval or disconnection. This supports choosing Open in Chrome before Connect without losing the pairing secret when a new tab has separate session storage. A regression test verifies transfer to a new tab and removal of the fragment on approval. The pairing token still expires and remains one-use; no recovery credential is placed in the address bar. The updated client suite passes all twenty-three cases.

## Browser cookie recovery — 2026-10-25

This supersedes the tab-only reconnection credential described above. Approval now grants a host-only Secure, HttpOnly, SameSite=Strict cookie through a one-use HTTP exchange. The authorization expires after 30 minutes without input or foreground resumption; cookie refresh alone does not extend it. Disconnect, service restart, desktop lock, and extension disable revoke authorization in server memory.

All forty automated tests pass. Real GJS/libsoup HTTP and TLS checks cover cookie issuance, exchange replay rejection, recovery, activity extending the idle deadline, expiry despite cookie refresh, and explicit disconnect/restart revocation. The separate Chromium test verifies cookie flags and JavaScript isolation, fresh-tab recovery without another approval, recovery after restarting the whole browser with its saved profile, and denied recovery after disconnect. It uses an isolated profile and pins only its generated test certificate.

The v0.1.0 archive builds successfully and contains only runtime sources, metadata, web assets, and the license. The user confirmed on the physical phone that closing the tab and reopening the plain PC address restores control without another approval. Chrome/Lens cookie sharing and every mobile process lifecycle remain outside this confirmation.
