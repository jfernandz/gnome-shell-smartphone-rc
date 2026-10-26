# Changelog

## 0.5.4 — 2026-10-27

- Organize Settings into native Network, Pointer, Security, Devices and About tabs with adaptive navigation.
- Show certificate status, fingerprint, expiry and verification guidance in Security, updating them after successful network configuration or renewal.
- Clarify Apply network configuration and add a Renew certificate shortcut that opens Network and focuses the address without applying changes automatically.
- Add a symbolic GitHub icon beside the Source code link in About, retaining its text and accessible name; include the upstream MIT license.
- Extend isolated native preferences checks for tab navigation, keyboard focus, narrow layouts and certificate updates, renewal and failure preservation.

## 0.5.3 — 2026-10-27

- Use an outline symbolic panel icon combining a touchpad with wireless waves pointing to the right. Expand strokes into filled paths so GNOME symbolic recoloring preserves the hollow design. Keep a standard 16-by-16 grid and theme-controlled panel sizing.

## 0.5.2 — 2026-10-26

- Ignore stale session HTTP/JSON responses across browser connection changes and explicit Disconnect; cancel superseded requests and ignore malformed WebSocket messages. Disable phone input immediately on Disconnect.
- Separate Shell menu rendering from transition effects; preserve focus, keyboard and pending approval resources on repeated states.
- Isolate temporary helper authorization and expiry, name transport limits separately, and test Shell startup-response validation independently. Add delayed-response and isolated native regressions.

- Fix development ZIP installation on GJS by using bounded `mktemp -d` instead of unavailable `GLib.mkdtemp()`. Settle Shell enablement changes before restoring a disabled copy.
- Add a self-contained isolated native test launcher, real first-install/disabled rollback and ZIP replacement checks, and an optional bounded TLS load/recovery test.
- Record pre-publication checks and prepare unsent reviewer/release drafts.

## 0.5.1 — 2026-10-26

- Restore the previous enabled/disabled settings and installed files when ZIP installation fails, including failed first installations and source-loaded copies.
- Validate and install from one private ZIP snapshot, then remove the snapshot when the operation finishes.
- Bound installer commands with 30-second timeouts, support cancellation, and reap direct child processes before rollback using the shared subprocess helper.
- Escape private D-Bus socket paths so temporary directories containing commas work correctly.
- Add installer behavior regressions and real GJS service checks with comma-containing temporary paths. Document safe manual cleanup of retained backups, import aliases and source snapshots after session shutdown.

## 0.5.0 — 2026-10-26

- Add a ZIP-command generator that selects the newest built ZIP or an explicit path and updates a private selection record, allowing the same Looking Glass command to install later archives without filename edits.
- Add a Looking Glass ZIP installer/reloader that uses the official installer and fresh import aliases of the actual installed files, with UUID preflight checks and restoration on failed loading. Keep source reload and ZIP acceptance workflows separate.
- Replace the custom JSON-pipe IPC with typed, acknowledged private D-Bus methods, Unix UID/PID checks on both peers, bounded application messages/queues/rates, startup and call deadlines, and cleanup on stop/crash/parent disappearance. No session-bus service or extra application installation is required.
- Group the separately executed network helper, server, connection guard and mobile web client under app/. Remove ipc.js and verify process/module boundaries in packaging tests.

## 0.4.7 — 2026-10-25

- Expose keyboard disclosure state and sensitivity multiplier to assistive technology; label editor help and per-browser Settings actions, and restore focus when hiding the editor.
- Add visible keyboard focus, a taller sensitivity target, wrapping connection controls and touchpad instructions that fit enlarged text.
- Add focused Chromium accessibility/layout/contrast checks and native theme/font/accessible-label checks, with documented remaining coverage.


- Add ESLint correctness checks for GJS, browser and Node code, with pinned development dependencies, a lockfile and a lint command. Keep all lint tooling out of runtime ZIPs.
- Preserve the original cause for occupied-port errors, remove a dead test-fixture assignment and simplify the runtime-path validation expression without changing its accepted paths.

## 0.4.6 — 2026-10-25

- Use cancellable asynchronous GIO for configuration/certificate reads and old-certificate cleanup in Shell. Cancel pending startup on Stop/disable to prevent stale helpers or dialogs.
- Document all seven shexli findings, lifecycle ownership evidence and separate worker/web entry points; pin an optional working static-review toolchain.

## 0.4.5 — 2026-10-25

- Validate certificate validity dates and IP subject alternative names explicitly, sharing validation between reading and generation. Reject expired, not-yet-valid and mismatched certificates before publishing configuration.
- Finish validating staged credentials before atomically replacing network configuration; failed generation/publication preserves previous credentials.
- Extract subprocess execution and wait for child termination on cancellation/timeout before removing partial files.
- Clean unreferenced generated certificate directories older than 24 hours before service startup, after stopping the previous helper. Preserve selected/recent credentials, staging directories, legacy files, symlinks and directories containing unexpected files.
- Add regressions for certificate validity, publication failure, cancellation/timeout child cleanup and conservative certificate retention.

## 0.4.4 — 2026-10-25

- Add isolated first-run regressions for missing OpenSSL, iproute2 and prlimit, failed/malformed address discovery, no local addresses, partial certificate failures, and occupied ports. Preserve existing credentials and clean up failed startup resources.
- Make dependency and tool-failure messages actionable, explain how to resolve an occupied port, and clear stale discovery errors after a successful Refresh.

## 0.4.3 — 2026-10-25

- Read About version and repository from installed metadata rather than GNOME's cached session metadata. Show both versions and an update-pending explanation when they differ.

## 0.4.2 — 2026-10-25

- Add an About section to Settings showing the loaded preferences copy's version from metadata, the license, and a source repository link.

## 0.4.1 — 2026-10-25

- Add the public GitHub repository URL to extension metadata.
- Record successful physical-phone acceptance of the v0.4.0 ZIP installation and Settings-based configuration flow.

## 0.4.0 — 2026-10-25

- Add Settings → Network with local IPv4 detection, configurable port, private certificate generation/renewal, fingerprint and expiry. Offer Open Settings when Start lacks valid configuration, preserving existing setups and removing the terminal requirement from normal first use.
- Remove the network setup script and its unused address-validation helper; native preferences now own network configuration.
- Refresh project documentation, the implementation plan, and validation guidance; add a contribution guide.
- Remove the obsolete ADB page-opening helper, move shared script helpers under scripts/lib, and document active entry points. Preserve the existing Looking Glass reload paths and stage development snapshots directly.

## 0.3.1 — 2026-10-25

- Show Start only when remote control is off, Stop while starting/running, and Reject/Disconnect only when a request or phone is present. Preserve the stopped menu after lock/unlock and helper failure.
- Rename the menu actions to Start/Stop remote control and describe networking as LAN rather than Wi-Fi-specific.

## 0.3.0 — 2026-10-25

- Reject HTTP bodies, transfer encoding, oversized headers/URIs, and query credentials before normal handlers; bound connection counts, accept/request rates, handshake/header deadlines, and closing handshakes.
- Enforce a 2 KiB total WebSocket message limit and require libsoup 3.8 or later. Authenticate new browsers in the first WSS message with a short deadline and bounded unauthenticated sockets.
- Move network serving into a GJS child with private bounded IPC, Shell-side input validation, data/file-descriptor limits, and disabled core dumps. Stop input if the child or pipe fails, and exit the child if its parent disappears.
- Require a desktop acknowledgement of matching browser/PC certificate fingerprints before first approval; compute and cross-check the local fingerprint independently.
- Add 7/30/90-day trust settings for new enrollments, retaining the existing default and recorded expiry of existing browsers.
- Add transport, process-lifecycle, browser-helper, certificate-dialog, and trust-policy regression checks; document the security model.

## 0.2.2 — 2026-10-25

- Prevent metadata updates and stale enrollment snapshots from restoring revoked browser trust. Separate per-browser revocation/name/usage settings and global trust generations, preserving existing remembered browsers.
- Separate server connection acceptance, message processing, session validation, and cookie issuance into focused methods.
- Centralize mobile connection transitions and share approval/resume handling. Test the actual ES modules through an explicit browser environment instead of rewriting imports.
- Split preferences into sensitivity and trusted-device groups; update existing device rows instead of rebuilding the list for metadata changes.
- Share sensitivity and input limits across desktop and browser code. Use one runtime manifest for serving, local installation, and ZIP staging.
- Add stale-write regressions across independent GJS processes, per-browser revocation browser coverage, and manifest/schema consistency checks.

## 0.2.1 — 2026-10-25

- Re-enable Connect after disconnecting a remembered browser, allowing manual reconnection without refreshing or reconnecting automatically on foreground.
- Integrate each trusted browser name, dates, rename action, and Forget action into one preferences row.
- Increase the default Settings window size to 760 × 820 while keeping it resizable.

## 0.2.0 — 2026-10-25

- Add Accept, Accept and remember, and Reject actions to pairing notifications, with cleanup when requests are resolved or the service stops.
- Add native Settings for pointer sensitivity limits, live mobile-slider updates, and default restoration.
- Add opt-in remembered browser credentials with a fixed 90-day lifetime and verifier-only storage in GNOME settings.
- Add editable trusted-browser names, approval/last-used/expiry dates, individual revocation, and Forget all.
- Separate Disconnect from Stop service and Forget; retain manual startup after login or desktop lock.
- Add subtle menu action colors for selection and keyboard focus.
- Extend browser tests to cover service process restart, persistent trust, revocation, and isolation between trusted browsers.
- Record a preliminary publication review; extensions.gnome.org submission remains pending.

## 0.1.0 — 2026-10-25

Initial release for GNOME Shell 51, tested on 51.1 with Wayland.

- Local Wi-Fi touchpad and live keyboard control from a smartphone browser.
- HTTPS/WSS, temporary QR invitations, and explicit desktop approval.
- Browser session recovery using a Secure, HttpOnly, SameSite=Strict cookie with a 30-minute inactivity limit.
- Immediate authorization revocation on disconnect, service restart, desktop lock, and extension disable.
- Background pause, automatic recovery, and an always-available new pairing QR while the service is active.
- Pointer sensitivity from 0.5× to 10× in half-step increments.
- Native mobile keyboard requests, live editing, IME composition, and a layout that follows the visible keyboard area.
- Bounded text edits with native Backspace handling and acknowledgement-based ordering.
- English documentation, focused regression tests, and a development reload command that does not require logging out.

### Known limitations

- Initial network/certificate setup is manual; local self-signed certificates require browser verification.
- One approved browser connection at a time; changing the PC address requires setup and pairing again.
- Input-method support depends on the application. Typing pauses when the target does not acknowledge edits; full PC/mobile cursor and selection synchronization is not implemented.
- Browser windows opened through Lens may have different lifecycle or cookie storage from normal Chrome tabs. Opening directly in Chrome is recommended.
- GNOME versions other than 51 and iOS Safari are not validated.
- This release is a local preview, not an extensions.gnome.org approval or a published GitHub release.
