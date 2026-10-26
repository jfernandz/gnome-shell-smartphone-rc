# Project plan

## Goal and scope

Provide smartphone-browser pointer and keyboard control of an unlocked GNOME desktop over the local network, without a mobile app. Target GNOME Shell 51 on Wayland first; the development desktop runs 51.1. All source, UI text, comments, and documentation are in English.

The PC may use Ethernet while the phone uses Wi-Fi. One browser controls the desktop at a time. Screen streaming, internet relays, file transfer, login/lock-screen control, and remote wake-up are outside the current scope.

## Completed milestones

- [x] **v0.1.0 — LAN control:** native top-bar menu and QR, HTTPS/WSS, expiring pairing and desktop approval, touchpad/clicks/two-finger scroll, live mobile typing with composition handling, focus detection, and temporary-cookie recovery.
- [x] **v0.2.0 — Preferences and trust:** actionable notifications, sensitivity limits, opt-in remembered browser profiles, editable labels, expiry and immediate revocation, and menu action colors.
- [x] **v0.2.1 — Usability:** reconnect after Disconnect without refreshing, integrated trusted-browser rows, and a larger preferences window.
- [x] **v0.2.2 — Quality:** separate trust revocation from metadata, organize server/browser/preferences responsibilities, and share limits and runtime-file declarations.
- [x] **v0.3.0 — Security:** guarded transport, bounded network child and private IPC, complete-message WebSocket limits, mandatory manual certificate comparison for first approval, pairing outside URL queries, and configurable trust duration.
- [x] **v0.3.1 — Lifecycle:** state-dependent Start/Stop/Reject/Disconnect actions and LAN-neutral wording.
- [x] **Post-release maintenance:** remove the obsolete phone-opening helper, consolidate internal script helpers, and preserve the reusable Looking Glass reload entry point.

- [x] **v0.4.0 — Settings-based setup:** local address detection, configurable port, certificate generation/renewal and details, first-start Settings prompt, and removal of the manual network setup script. Physical-phone acceptance confirmed.

These are local releases. They do not imply GitHub publication or extensions.gnome.org acceptance. Detailed changes are in [CHANGELOG.md](CHANGELOG.md); evidence and limits are in [TESTING.md](TESTING.md) and [SECURITY.md](SECURITY.md).

## Remaining validation and distribution work

- [ ] Expand the application/IME compatibility matrix, including replacement, Unicode fallback, and long editing sessions.
- [ ] Record current phone/browser versions and test iOS Safari when available.
- [ ] Validate multiple monitors, desktop scaling, orientation changes, gesture cancellation, and long sessions across network interruptions.
- [ ] Complete sustained resource-exhaustion testing and assess further OS isolation.
- [ ] Complete accessibility/theme checks and capture screenshots.
- [ ] Improve first-use network/certificate setup for public users.
- [ ] Complete the publication review, including clarification of bundled web-interface reviewability.
- [ ] Prepare the actual repository URL and release materials, then publish only when requested.

Use [PUBLICATION.md](PUBLICATION.md) for distribution readiness and [IDEAS.md](IDEAS.md) for proposed features. Automatic service startup and post-unlock restart remain proposals, not current behavior.

## Working agreement

Keep changes small and reviewable. Validate protocol and authorization changes with focused automated tests; use browser checks for recovery and editing behavior. Native Shell checks run in an isolated compositor. Never restart or lock the working desktop for a test.

Development reload builds a fresh source snapshot and replaces only this extension; it stops existing remote connections. Preserve the stable `scripts/reload.js` entry point so the user's Looking Glass history continues to work. See [CONTRIBUTING.md](CONTRIBUTING.md).

Record what was actually tested, distinguish remaining checks from failures, and require physical-phone acceptance for significant interaction changes before closing a release.

## v0.5.0 — private D-Bus and app layout

- [x] Replace inherited JSON pipes with typed, authenticated private peer D-Bus while retaining bounded application calls and lifecycle cleanup.
- [x] Group the worker/server/guard and mobile assets under app/, preserving a single runtime package.
- [x] Test peer identity, typed values, application limits, invalid state/input, cancellation, crash and parent loss; enforce import/process boundaries.
- [x] User confirmed the migrated implementation works before closing v0.5.0. The final tagged ZIP remains a separate manual acceptance check.

See [DBUS.md](DBUS.md) for contract, security limits and implementation evidence; maintainer guidance does not imply final publication approval.
