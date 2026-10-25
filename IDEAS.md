# Ideas

Feature checklist: unchecked items are proposals; checked items are implemented. See [CHANGELOG.md](CHANGELOG.md) for release history and [TESTING.md](TESTING.md) for validation and remaining coverage.

- [ ] **Remote volume control.** Add a mobile slider and mute/unmute action for the current default audio output, using GNOME's mixer integration. Reflect desktop-side changes and output-device switches, handle missing outputs, and keep volume within the normal 0–100% range by default. Accept only bounded authenticated actions through the existing validated IPC.

- [ ] **Remote desktop lock.** Add an explicit mobile action to lock the current GNOME session. Explain that locking immediately stops the remote service and disconnects the phone; unlocking and service reactivation remain local actions. Verify that queued input cannot run after locking.

- [ ] **Remote suspend.** Add a mobile action to suspend the PC, with a confirmation to prevent accidental taps. Check suspend availability through GNOME/systemd-logind, respect inhibitors and authorization requirements, and report unsupported or denied requests. Lock the session before sleep, stop remote control, and require local service reactivation after resume. Do not promise remote wake-up; it would require a separate design.

- [ ] **Optional service startup after login.** Add a setting, disabled by default, to start the service automatically after GNOME login. Depend on trusted-browser support so remembered browsers can connect without another approval; new browsers still require QR pairing and desktop approval. Disconnect on desktop lock, with automatic reconnection after unlock controlled by a separate opt-in setting. Keep stop and device-revocation actions available, explain that an authorized browser can control an unlocked desktop over the local network, and exclude control of the login and lock screens.

- [x] **Configurable sensitivity range.** Let users set the minimum and maximum pointer sensitivity in extension settings, with a **Restore defaults** action. Apply the range to the mobile slider, retain 0.5 increments, require the minimum to be below the maximum, and clamp the current sensitivity when the range changes. Keep an independent internal bound for safe pointer movement.

- [x] **Accept and reject actions in pairing notifications.** Add **Accept** and **Reject** buttons to the GNOME notification shown when a phone requests a connection. Reuse the menu's approval/rejection logic and remove the actions when the request expires, is resolved elsewhere, or the service stops.

- [x] **Subtle colors for extension menu actions.** Add gentle hover and keyboard-focus colors to the extension's top-bar menu actions, distinguishing pairing/connection actions from stop/disconnect actions while preserving readability and compatibility with GNOME Shell themes.

- [x] **Settings panel with trusted devices.** Remember approved browsers so they can reconnect without a new QR code after restarting the service or desktop.
  - [x] Offer **Remember this browser** during desktop approval. Identify the browser profile through a persistent random credential in a Secure, HttpOnly, SameSite=Strict cookie, with a protected verifier stored on the PC. Do not use hardware identifiers, fingerprinting, or IP addresses as identity.
  - [x] List trusted browsers with an editable name, authorization date, and last-used date. Allow revoking one or all, immediately terminating affected connections.
  - [x] Separate **Disconnect** (end the connection but preserve trust) from **Forget device** (revoke trust). Keep persistent trust separate from the current temporary session authorization.
  - [x] Lock behavior: disconnect on desktop lock and require service reactivation from the PC menu after unlocking; trusted browsers may then reconnect without another approval.
  - [x] Define credential expiry, renewal, rotation, and storage permissions. New browsers and browsers with cleared cookies must pair again.
  - [x] Validate restart and lock/unlock recovery, individual/global revocation, expiry, cleared cookies, and separate browser profiles.
