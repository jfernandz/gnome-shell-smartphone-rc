# Ideas

Feature checklist for future versions. Check items as they are implemented and verified.

- [ ] **Optional service startup after login.** Add a setting, disabled by default, to start the service automatically after GNOME login. Depend on trusted-browser support so remembered browsers can connect without another approval; new browsers still require QR pairing and desktop approval. Disconnect on desktop lock, with automatic reconnection after unlock controlled by a separate opt-in setting. Keep stop and device-revocation actions available, explain that an authorized browser can control an unlocked desktop over Wi-Fi, and exclude control of the login and lock screens.

- [ ] **Configurable sensitivity range.** Let users set the minimum and maximum pointer sensitivity in extension settings, with a **Restore defaults** action. Apply the range to the mobile slider, retain 0.5 increments, require the minimum to be below the maximum, and clamp the current sensitivity when the range changes. Keep an independent internal bound for safe pointer movement.

- [ ] **Accept and reject actions in pairing notifications.** Add **Accept** and **Reject** buttons to the GNOME notification shown when a phone requests a connection. Reuse the menu's approval/rejection logic and remove the actions when the request expires, is resolved elsewhere, or the service stops.

- [ ] **Subtle colors for extension menu actions.** Add gentle hover and keyboard-focus colors to the extension's top-bar menu actions, distinguishing pairing/connection actions from stop/disconnect actions while preserving readability and compatibility with GNOME Shell themes.

- [ ] **Settings panel with trusted devices.** Remember approved browsers so they can reconnect without a new QR code after restarting the service or desktop.
  - [ ] Offer **Remember this device** during desktop approval. Identify the browser profile through a persistent random credential in a Secure, HttpOnly, SameSite=Strict cookie, with a protected verifier stored on the PC. Do not use hardware identifiers, fingerprinting, or IP addresses as identity.
  - [ ] List trusted browsers with an editable name, authorization date, and last-used date. Allow revoking one or all, immediately terminating affected connections.
  - [ ] Separate **Disconnect** (end the connection but preserve trust) from **Forget device** (revoke trust). Keep persistent trust separate from the current temporary session authorization.
  - [ ] Proposed lock behavior: disconnect on desktop lock and require service reactivation from the PC menu after unlocking; trusted browsers may then reconnect without another approval.
  - [ ] Define credential expiry, renewal, rotation, and storage permissions. New browsers and browsers with cleared cookies must pair again.
  - [ ] Validate restart and lock/unlock recovery, individual/global revocation, expiry, cleared cookies, and separate browser profiles.
