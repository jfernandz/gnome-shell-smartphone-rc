# Changelog

## 0.9.0 — 2026-10-29

- Group Network, Automatic start and Automatic stop under Service; keep certificates and browser authorization in Security. Adapt the initial settings window to the monitor size and scaling, with a taller layout on larger screens.

- Add independent, default-off startup after login and restart after unlock settings. Unlock restart requires control to have been active before locking; Stop, timer expiry and remote lock/suspend leave it off.
- Start automatically without opening pairing dialogs, preserve approval/trust boundaries and report configuration failures without retrying.

## 0.8.0 — 2026-10-28

- Add confirmed Lock PC and Suspend PC controls. Discard pending phone input, stop/revoke temporary control, then lock; suspension respects GNOME/logind availability, authorization and inhibitors. Resume/unlock requires local service reactivation.
- Keep PC suspension distinct from phone-background transport pause, reject later packets after a terminal request, and cancel stale system preflight on local Stop/Start/disable.
- Add protocol, browser, real helper/D-Bus and session-policy regressions; isolated native checks inject the power/lock backend without affecting the host session.
- Attach only the installable and publication ZIPs to GitHub releases; retain images, notes, checksums and reports inside the publication bundle.

## 0.7.0 — 2026-10-28

- Add an opt-in automatic stop timer in Security settings: 1–1440 minutes, default 30, counting total time from successful service startup. Show remaining time and local extend/cancel actions in the desktop menu; expiry uses Stop cleanup without restarting.
- Cover timer deadlines, cancellation, stale callbacks, settings synchronization and real isolated Shell expiry/lock cleanup.
- Refresh and shorten user/developer guides, update controls and release instructions, and distinguish current evidence from historical validation reports.
- Unify version-tag validation, Node 22/24 lint/tests, publication generation and draft-release creation in one workflow, reusing CI receipts instead of repeating tests.
- Attach the exact verified ZIP, selected screenshots, icon, release notes, checksums and a complete publication bundle to drafts. Manual runs regenerate artifacts without modifying releases; PR/main CI no longer runs for tags.
- Populate GitHub release bodies with the full version-specific changelog and a commit-comparison link, including when refreshing drafts.
- Document system, npm and optional review dependencies by development task, and install/run actionlint through the system package manager in CI.
- Add one development-environment script with check/install modes and optional browser, publication, native and review profiles, using pacman, npm and the existing review venv.

## 0.6.3 — 2026-10-28

- Keep the controls card inside narrow portrait viewports with taller system fonts and 200% text by reducing gaps and moving it toward the safe top edge.
- Measure accessibility bounds after the opening animation finishes and include card geometry in layout-failure diagnostics.

- Launch the publication browser with a CI-only container wrapper and retain Chromium startup stderr, including when preparing an older tag.
- Print failing publication logs in Actions and report Chromium early-exit codes and stderr directly from the browser harness.

## 0.6.2 — 2026-10-28

- Add a publication-preparation command that archives an exact version tag, runs its automated and browser checks, verifies the packaged files against the tagged source, and generates screenshots, a PNG icon, release notes, listing text and evidence with checksums.
- Add a GitHub Actions workflow for version-tag pushes and manual preparation of an existing tag, retaining the generated bundle for 30 days without submitting to extensions.gnome.org.
- Document the generator, pending acceptance checks and local v0.6.1 preparation evidence.

## 0.6.1 — 2026-10-28

- Maximize the mobile touchpad in portrait and landscape, moving connection/keyboard, sensitivity and sound actions into a padded card opened by a floating ••• button, with no intermediate menu.
- Keep the phone editor outside the panel, preserving text, focus and selection across rotation without page scrolling.
- Replace click buttons with tap for left click and a 550 ms hold for right click; cancel holds on movement, multitouch, capture loss, cancellation, backgrounding or disconnect.
- Check the controls card at standard and enlarged text sizes, short landscape viewports, panel dismissal/focus restoration and keyboard disclosure in Chromium.

## 0.6.0 — 2026-10-27

- Add mobile volume and mute controls for GNOME's default audio output, synchronized with desktop changes and output switches. Remote adjustments are capped at 100%; unavailable outputs disable the controls.
- Validate audio commands independently in the network child and Shell, ignore commands for a previous output, and remove mixer observers and pending updates on suspension, disconnect, lock or stop.
- Add volume protocol, mixer lifecycle, D-Bus, authenticated server and browser regressions; extend mobile accessibility checks.
- Run GitHub CI on PRs, main pushes and tags, retain downloadable ZIP artifacts, and create draft releases with ZIPs and generated notes for matching version tags.

## 0.5.5 — 2026-10-27

- Prevent delayed Network startup/discovery results from overwriting Apply, newer discovery results or unsaved edits; ignore completions after preferences close.
- Extract the About group and declare each Settings page's groups directly, preserving the existing UI and cleanup ownership.
- Keep temporary authorization state private and replace server field assignments with explicit enrollment, trust-binding and exchange-cancellation methods.
- Add deterministic delayed-operation native regressions and GJS authorization ownership/revocation tests.

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
