# Validation record

## Current baseline

The latest local release is **v0.4.7**, targeting GNOME Shell 51 and tested on 51.1 with Wayland. The v0.3.1 release validation recorded 54 automated tests, Chromium recovery/trust checks through the real network helper, and isolated native preferences, certificate-approval, helper-failure, and lock/unlock checks. The physical Android phone confirmed LAN control, scrolling, typing, remembered-browser recovery, Settings, and the corrected lifecycle menu.

The later script cleanup was checked with five packaging/schema/process integration cases, isolated setup/install/reload smoke checks, and Chromium helper recovery/revocation checks. These focused checks do not represent a new full-suite run.

Run the current automated suite from the repository root:

```sh
node --test tests/*.test.js
node tests/cookie-browser.mjs --trusted --helper
SMARTPHONE_RC_TEST_TRUST_DAYS=7 node tests/cookie-browser.mjs --trusted --helper
```

Requirements and additional browser commands are in [README.md](README.md#development). Current server tests use ephemeral loopback ports; they do not require stopping the working desktop's service. Native Shell tests must use an isolated compositor and D-Bus session, never the working desktop. Do not lock or restart the user's session to run them.

Remaining coverage includes iOS Safari, multiple monitors/scaling, accessibility/themes, sustained resource-exhaustion testing, and a broader application/IME compatibility matrix. Android/Chrome versions below describe the initial recorded environment, not certification of later browser updates. See [SECURITY.md](SECURITY.md) for security limits and [PUBLICATION.md](PUBLICATION.md) for release-distribution work.

## Historical validation journal

The following entries preserve observations in implementation order. Test counts, commands, paths, limitations, and pending work describe each stage; later entries may supersede them. In particular, the early local prototype and its forwarding setup are not the current LAN usage instructions.

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


## v0.2.0 — 2026-10-25

The automated suite passes all 43 cases. New checks cover sensitivity-range validation and live clamping on the phone, plus trusted-browser verifier storage, expiry, naming, last-use updates, persistence, and individual/global revocation.

Real Chromium checks pass for both temporary and remembered sessions. The remembered flow verifies Secure/HttpOnly/Strict flags, browser restart, a complete GJS service process restart using an isolated persistent settings profile, and reconnecting without a new approval. Disconnect preserves trust; Forget revokes active control, rejects the saved credential, and clears the stale cookie. A second trusted browser cannot take over an active connection or obtain that browser's temporary session cookie. Temporary sessions retain their original disconnect/restart revocation behavior.

A separate GNOME Shell 51.1 compositor verified the native notification actions and removal after accept, reject, stop, and the real 30-second pending-request timeout. Entering its unlock-dialog mode stopped the extension service and notification; leaving that mode did not restart the service. The user's real desktop was not locked or restarted.

The real GTK/Adwaita preferences rendered and passed range ordering, persistence, Restore defaults, live trusted-list updates, rename, and Forget checks. This used an in-memory settings backend and the isolated compositor. The optional reproduction harness is `tests/preferences-native.mjs`: run it with `GSETTINGS_BACKEND=memory`, an isolated display/session, and the path to an installed extension directory containing compiled schemas. Accessibility activation in the isolated preferences service failed, so widget verification used the standalone harness with `GTK_A11Y=none`; this does not validate accessibility.

Rapid connection/stop checks exposed GNOME 51's QR generator completing after its actor was destroyed. The dialog now cancels its pending generator before destruction. Immediate open/close stress checks completed without new disposed-actor errors.

The ZIP includes preferences, stylesheet, trust/settings modules, and schema XML. A disposable install with `gnome-extensions install` compiled the schema successfully. An initial attempt using a temporary data directory on tmpfs failed with the installer's directory-copy error; installing into an isolated directory on the home filesystem succeeded. No certificates, credentials, configuration, tests, or development scripts are shipped. The v0.1.0 artifact remains built from its original tag.

The user confirmed on the physical phone that a remembered browser recovers control without another approval after stopping and restarting the service, and that Settings works. Notification actions were verified in the isolated native checks above; their complete mobile-to-desktop flow was not separately confirmed by the user. Desktop reboot, iOS, complete theme/accessibility coverage, network exhaustion, and public extension review are not established by these tests. See PUBLICATION.md for outstanding publication work.


## Manual reconnect and integrated device rows — 2026-10-25

The mobile client now checks server authorization after an intentional socket close. A remembered browser gets an enabled Connect button without a page refresh, while revoked temporary approval keeps it disabled. Returning to the foreground does not undo an explicit disconnect. All 45 automated tests pass, including client regressions for both authorization cases. Real Chromium confirms Disconnect → Connect on the same page without a new approval, as well as subsequent Forget revocation.

Trusted-browser preferences now use the browser name as the title of a single row containing its dates and rename/Forget actions. A native GTK/Adwaita check verifies that integrated row, opens the rename dialog, activates Save, and then revokes the entry. It uses an in-memory settings backend and an isolated compositor.

The v0.2.1 patch also increases the default Settings window to 760 × 820. The user confirmed the larger window is satisfactory.


## v0.2.2 quality refactor — 2026-10-25

All five review items are implemented in the local v0.2.2 release without changing the input backend:

- Enrollment grants remain compatible with v0.2.1. Per-browser name/last-use values and permanent revocation use independent settings keys; Forget all advances the trust generation. Only enrollment writes the grant list. A metadata write cannot restore authorization, and stale grant snapshots cannot undo individual or global revocation.
- Server startup, connection acceptance, message handling, session validation, and cookie issuance are separate methods. Cookie flags and authorization validity each have one implementation.
- The browser initializes through `createClient(environment)`. Connection state drives controls, approval/resume share a transition, and tests import the actual client/keyboard/touchpad/viewport modules without source rewriting.
- Preferences have separate sensitivity and device groups with explicit signal cleanup. Device rows are retained across name/usage updates; only added or removed entries create or remove rows. Trust settings use a separate object from delayed sensitivity transactions.
- Shared limits and validation live in `limits.js`. Runtime installation, packaging, and HTTP assets use `resources.json`; package staging contains only declared runtime files.

All 48 automated cases pass. Added checks include schema/shared-rule consistency, exact ZIP contents, legacy enrollment compatibility, overlapping metadata/revocation, watch cleanup, and stale snapshots restored by independent GJS processes using real persistent settings. Both individual and global revocation remain effective after those stale writes.

Real Chromium checks pass for temporary approval, remembered trust, browser/service restarts, manual reconnect without refresh, isolation between trusted browsers, and individual/global revocation. The browser test now retries transient directory cleanup failures from Chromium helper shutdown; this does not alter application behavior.

Native GTK/Adwaita checks pass for range persistence/default restoration and integrated device rows, including row identity across last-use updates, rename, and Forget. Isolated GNOME checks pass for notification actions/cleanup, pending-request expiry, lock-mode shutdown, and no automatic restart after unlock. Native settings/notifications tests use an isolated compositor; the user's desktop was not restarted or locked.

Existing remembered-browser grants require no migration write or new credential: absent generation fields map to the initial generation and per-browser metadata/revocation defaults preserve their values. Reload the extension before using the updated preferences so both processes use the new authorization model. Physical mobile acceptance of this refactor remains a follow-up check.


## v0.3.0 security hardening — 2026-10-25

All six security review items are included in the local v0.3.0 release:

1. A guarded TCP listener limits live connections before TLS/HTTP parsing. Handshake/header deadlines, bounded closing handshakes, accept/request budgets, short-lived HTTP transports, empty-body enforcement, header/URI limits, and early handlers cover every route. Unauthenticated WebSockets have a separate small budget and authentication deadline.
2. GNOME Shell launches a GJS network child through prlimit with private inherited pipes. Data allocation, descriptors, core dumps, private-pipe line/queue size, and message/input rates are bounded. Input is validated again in Shell. Process/pipe failure stops input, and parent disappearance exits the helper. This is fault isolation under the same user identity, not an OS sandbox.
3. Both WebSocket frames and assembled messages are limited to 2 KiB using libsoup 3.8. Oversized fragmented messages close the connection before pending approval or input dispatch.
4. New-browser approval requires a native certificate comparison acknowledgement. The local certificate fingerprint is computed independently in Shell and cross-checked with the helper. This remains manual verification of the actual browser certificate, not automatic pinning or a trust claim based on page/QR text.
5. Pairing credentials travel in the first WSS authentication message, not the handshake query. URL query credentials are rejected. Already authorized cookies remain usable when reopening a scanned link, without disconnecting on its redundant authentication message.
6. Settings offers 7/30/90-day lifetimes for new enrollments; existing trust keeps its recorded expiry. Unsupported configured values fall back to seven days. The normal default remains 90 days.

All 54 automated tests pass. New transport checks prove rejection of a 1 MiB upload before 100 Continue, oversized headers, query credentials, fragmented payloads, stalled authentication, and slow-header connection exhaustion. Process checks inspect the real child limits, kill the helper, kill its parent, and verify that the listener closes. Existing authorization, revocation, input and packaging checks continue to pass.

Chromium tests exercise the real network helper with temporary authorization and seven-day remembered trust. Browser restart, full service-process restart, reopening a scanned link with a valid cookie, same-page Disconnect → Connect, cross-browser isolation, and individual/global revocation pass. The seven-day cookie lifetime is checked against the recorded policy.

Native GTK/Adwaita checks pass for the duration selector, existing sensitivity behavior and device management. In an isolated GNOME 51.1 compositor, the real TLS approval dialog refuses approval before acknowledgement, then enables control after acknowledgement. Killing the child clears input/focus while Shell remains alive. Entering lock mode closes the pending certificate dialog and child; leaving it does not restart the service. The user's desktop was not locked or restarted.

The optional native harness is `tests/shell-security-native.mjs`. It requires an explicitly isolated Shell, `SMARTPHONE_RC_ISOLATED_SHELL=1`, and paths to that session's bus-address file and runtime directory. It must not be run against the user's working desktop.

The user confirmed the new flow works on the physical phone, including the requested certificate-approval/settings validation. Sustained/adversarial native-library saturation remains unvalidated. See SECURITY.md for the threat model and remaining limits. Existing v0.2.2 tags/artifacts are unchanged.


## v0.3.1 menu lifecycle and LAN wording — 2026-10-25

Start, Stop and Disconnect were previously unconditional menu actions, making the stopped state appear contradictory after unlocking. The menu now hides Start while starting/running, hides Stop while off, and shows Reject/Disconnect only for pending/connected/suspended phone states. An isolated native GNOME run verifies the initial stopped menu, pending and connected labels/visibility, helper-failure shutdown, and the stopped menu after lock/unlock. The user's real desktop was not locked or restarted.

Visible actions now say Start/Stop remote control. Setup documentation and messages refer to local networking/LAN; an Ethernet-connected PC remains supported. This is a presentation change, not a change to transport or authorization policy.

The user confirmed the corrected menu behaves better. Released locally as v0.3.1.


## Script cleanup — 2026-10-25

The public setup/install/package scripts and both development reload entry points remain in use. Shared staging, manifest enumeration, and IPv4 validation helpers now live under `scripts/lib/`; references in callers and integration tests were updated. The obsolete ADB page-opening helper and its current README instructions were removed. Historical test records remain unchanged.

Five packaging/schema/process integration cases pass with the new paths. An isolated smoke check verifies network setup, private-key permissions, invalid address rejection, and two distinct reload builds with compiled schemas. The reusable Looking Glass import path and prepare-reload.sh --build-only interface remain unchanged, preserving compatibility with already cached reload modules.

An isolated install matches the runtime manifest plus compiled schemas exactly. Chromium helper checks also pass after relocating staging, including browser/service restart, reconnect, and revocation.


## v0.4.0 Settings-based network setup — 2026-10-25

Network setup now runs in native preferences, with detected private IPv4 addresses, an editable address, port selection, and certificate fingerprint/expiry. The service remains manually started. Missing or invalid configuration opens a Shell dialog offering Settings. Legacy address-only configuration and certificates remain readable.

The GJS network setup regression checks generated certificate identity, the selected port, mode-0700 configuration directories, mode-0600 keys/configuration, invalid/nonlocal address rejection, failed-setup preservation, and legacy compatibility in a temporary directory. A native GTK/Adwaita check exercises address detection, Configure, and success-state display using a temporary XDG_CONFIG_HOME. No working configuration is changed.

The optional native check is `tests/network-preferences-native.mjs`; set SMARTPHONE_RC_NETWORK_TEST=1 and use a temporary XDG_CONFIG_HOME. It creates a real certificate, requires a graphical display and an active private LAN address, and must not be pointed at the normal configuration directory. The user confirmed that the new Settings workflow works on the physical setup.

All 55 automated tests pass, along with the Chromium trusted-browser/helper suite. The network setup regression supplies an isolated address-discovery fixture so it does not depend on a LAN connection, and checks preservation after a simulated OpenSSL failure. The native UI check uses actual interface detection.

The v0.4.0 release removes the obsolete network setup script and its unused address-validation helper. Existing configurations remain supported. Release checks rerun the full automated suite and Chromium helper recovery/trust checks, and inspect the generated runtime ZIP.


## v0.4.1 metadata and ZIP acceptance — 2026-10-25

The user confirmed that installation from the v0.4.0 ZIP and the subsequent configuration/control flow work as expected, without the development reload helper. This is physical acceptance of that installation path, not evidence of missing-dependency or broader compatibility coverage. v0.4.1 adds the public repository URL and updates release metadata/documentation; runtime behavior is unchanged. Packaging/schema/process checks and the generated ZIP metadata are checked for this patch.


## v0.4.2 About preferences — 2026-10-25

Native GTK/Adwaita checks verify that About shows the version and repository from the staged extension metadata, alongside the existing sensitivity, trust-policy, rename and revocation checks. The three packaging/schema/trust-process regressions pass and the v0.4.2 ZIP is generated. This patch changes preferences and documentation, not control transport or authorization.


## v0.4.3 Installed versus cached version — 2026-10-25

The working desktop reported session metadata v0.3.1 while the installed files contained v0.4.2. About now reads installed metadata from its extension directory and separately shows the cached GNOME session version when they differ. Native preferences regression checks deliberately pass older session metadata to newer installed preferences and verify both displayed versions and the installed repository link. Existing sensitivity, trust-policy, rename and revocation checks pass. Packaging/schema/trust-process regressions and v0.4.3 ZIP metadata checks pass.


## v0.4.4 First-run failure simulation — 2026-10-25

All 57 automated tests pass. New fixtures use temporary directories and process-local PATH overrides to simulate absent iproute2, OpenSSL and prlimit without uninstalling system tools. They also cover no private interfaces, failed/malformed address discovery, and certificate generation that writes partial files before failing. Working configuration/certificate identity remains intact and partial credential directories are removed. Missing prlimit starts no child and leaves control off.

An ephemeral loopback listener reserves a port while the real GJS network helper attempts startup. The resulting error explains the occupied port and Settings action, clears child/IPC/startup state, and permits a successful retry on an available port. Chromium trusted-browser recovery and revocation checks through the real helper continue to pass.

The native GTK check `tests/network-errors-native.mjs` runs with SMARTPHONE_RC_NETWORK_TEST=1 and a temporary XDG_CONFIG_HOME. It verifies visible missing-tool/no-address messages, Refresh recovery, removal of stale detection errors, and re-enabled configuration controls after failure. No system packages, working configuration, desktop lock state, or extension installation are changed by these checks. Use the same isolated temporary-environment precautions as the network preferences check above. Command timeout handling is explicit, but this run does not add timeout-duration or sustained exhaustion coverage.


## v0.4.5 Certificate setup hardening — 2026-10-25

The certificate regression creates real expired and future-dated self-signed certificates using OpenSSL CA date options, verifies explicit date/IP rejection, and simulates expired output during setup. Invalid generated output leaves the working configuration unchanged. A blocked configuration destination tests publication failure and retention of existing credential files.

Cancellation during a fake long-running certificate generator and an explicit short command timeout both verify that the direct child has been reaped before returning; partial credentials are removed and the previous configuration remains intact. Cleanup tests retain selected/recent/staged credentials, legacy or unrecognized files, symlinks and directories with extra files while removing eligible unreferenced old generations. Production cleanup runs only before service startup after stopping the previous helper. All checks use temporary files and fake tool discovery; the working desktop/session configuration is unchanged.

Release verification passes all 58 automated tests, the Chromium trusted-browser/helper recovery and revocation suite, and native GTK preferences/About, network setup, and missing-dependency/Refresh checks. The v0.4.5 ZIP is built from the runtime manifest and inspected for version, source URL and exact file contents. No working GNOME session was restarted or locked.


## v0.4.6 Static-analysis triage and asynchronous Shell I/O — 2026-10-25

The original v0.4.5 ZIP produces seven findings in shexli 0.2.1. Reproducing with tree-sitter 0.25.2 avoids the observed native crash with 0.26.0. v0.4.6 removes the synchronous-file-I/O warning, leaving six findings documented in SHEXLI.md, without suppressing rules or changing the released ZIP.

All 58 automated tests and Chromium trusted-browser/helper recovery checks pass after making configuration/certificate reads and certificate cleanup asynchronous. Native GTK preferences, setup and error recovery checks pass in the isolated compositor. Native Shell checks verify Stop and disable during pending startup, with no stale helper or setup dialog; all three flagged menu rows emit destroy on disable. Existing certificate approval, helper crash and lock cleanup checks also pass. The working desktop was not restarted or locked.


## v0.4.7 ESLint correctness checks — 2026-10-25

ESLint 10.13.0 with @eslint/js 10.0.1 and globals 17.13.0 checks project JavaScript with explicit GJS, browser and Node environments. The lockfile pins developer dependencies; no formatting preset is applied. Lint passes with zero errors and warnings. An intentional, line-specific no-control-regex exception retains rejection of control characters/lone surrogates; unused exception directives fail lint.

Reviewed corrections preserve the original cause when reporting an occupied port, remove an unused initial assignment in the server test fixture, and remove a redundant escape in the runtime path allowlist. Production protocol validation behavior is unchanged. All 58 automated tests, real Chromium trusted/helper checks and exact runtime ZIP manifest checks pass. A fresh npm ci followed by lint also passes; GJS/browser/Node global separation is checked explicitly. Tooling and node_modules are not shipped in the extension ZIP.

Initially npm was absent from PATH, so a temporary verified distribution outside the repository was used for dependency installation without changing system packages. The user subsequently installed npm 12.2.1, and npm run lint passes directly with the normal system command. No temporary npm path is required. Direct Node invocation documented in CONTRIBUTING.md remains an optional fallback. Native desktop/session state is unchanged.


## v0.4.7 Focused accessibility and layout checks — 2026-10-25

All 58 automated tests and lint pass. The new npm run test:accessibility mode exercises the real Chromium/helper session, checks keyboard Tab/Enter behavior, accessible control names, synchronized editor disclosure/focus, minimum target height, key-text contrast and portrait/landscape/200%-text reflow, then completes the trusted-browser recovery/revocation checks. Enlarged text exposed overflowing touchpad instructions; intrinsic sizing now keeps them inside the touchpad.

Native GTK preferences pass with GTK's test accessibility backend, checking labelled browser actions and the rename entry alongside existing preferences behavior. Isolated runs force light/Sans 11 and dark/Sans 22, render previews, and verify the requested theme. Synthetic browser/native previews were inspected; they are development artifacts, not publication screenshots. No working session theme, font, configuration or remote connection was changed.

See ACCESSIBILITY.md for exact commands and limits. Screen-reader announcements on real TalkBack/Orca, physical scaling, keyboard occlusion under enlarged text, high-contrast modes and other browsers remain manual follow-ups.


## Private D-Bus and app process layout — unreleased, 2026-10-26

Current development removes ipc.js, moves the network worker/server/guard and mobile web assets under app/, and uses typed acknowledged calls on an authenticated private Unix D-Bus connection. Existing released artifacts and tags remain unchanged. See DBUS.md for contract and security limits, including the distinction between application payload checks and native GDBus allocation.

New regressions cover typed Unicode/nested values, parent identity, unrelated same-user attachment before the helper, size/rate/queue bounds, cancelled startup, premature connected state and rejected invalid input. Process tests retain child resource-limit, helper-crash, parent-death/socket-directory cleanup, mode-0700 directory and occupied-port/retry coverage. Packaging checks enforce the runtime manifest and the separation of app code from Shell/preferences imports.

Chromium helper accessibility/recovery/trust checks pass through the real D-Bus child. The isolated native GNOME 51.1 run passes guided certificate approval, crash, lock shutdown, menu states and Stop/disable during pending startup. A new temporary compositor, driver and D-Bus session were used because earlier temporary fixtures no longer existed; the working desktop was not restarted, locked or changed. Physical-phone acceptance remains pending.

All 68 automated tests and ESLint pass. The generated development ZIP matches the runtime manifest exactly, contains app/ and shared dbus.js, and excludes ipc.js, tests and developer tooling. Static review retains the same six documented shexli findings; the new process layout does not suppress any rule.
