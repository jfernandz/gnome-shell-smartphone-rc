# Smartphone Remote Control — Project Plan

## Goal

Build a GNOME Shell extension that lets a smartphone browser control the desktop pointer and enter text, without installing a mobile app. All source code, UI text, comments, and documentation will be in English.

## Initial scope

- Target GNOME Shell 51 first; the development machine runs 51.1.
- Prioritize Wayland and test it explicitly.
- Connect over the local network, with one active phone at a time.
- Provide a top-bar menu, a locally generated QR code, explicit desktop approval, and a disconnect action.
- Provide a dark touchpad, tap to click, secondary click, two-finger scrolling, and a keyboard toggle.
- Support live text entry with the native mobile keyboard, including Enter and Backspace.
- Exclude screen streaming, internet relay servers, mobile apps, file transfer, and unattended access from the MVP.

## Phase 1 — Validate the technical foundation

- [ ] Verify pointer motion, clicks, scrolling, and keyboard injection in GNOME 51 on Wayland with a minimal local prototype.
- [x] Verify text entry, including accented characters, and document Unicode limitations.
- [ ] Validate HTTP/WebSocket serving with GJS and the lifecycle of a separate GJS helper if needed.
- [ ] Confirm how the phone reaches the PC, including interface selection and firewall behavior.
- [x] Choose transport security and pairing together: desktop approval alone does not encrypt traffic. Document browser certificate constraints and any accepted MVP limitation.
- [ ] Review extension packaging constraints for the chosen architecture and bundled web assets.

Exit condition: a phone can trigger a controlled input event on the PC, and the architecture, security model, and packaging approach are documented. Resolve blockers before building the complete UI.

## Phase 2 — Create the extension skeleton

- [x] Choose the public name, UUID, and compatible open-source license.
- [x] Add extension metadata, the top-bar indicator, and a minimal menu.
- [x] Implement explicit start/stop states and complete cleanup on disable.
- [x] Add local installation, development, and debugging instructions.

Exit condition: the extension can be installed, enabled, disabled, and re-enabled without leftover listeners, processes, signals, or input state.

## Phase 3 — Implement pairing and session control

- [x] Serve the mobile page and establish a WebSocket connection.
- [x] Generate the QR locally with an expiring pairing secret.
- [x] Require desktop approval before accepting control events.
- [x] Bind authorization to the approved session; reject unauthorized messages and unexpected browser origins.
- [x] Validate message types, sizes, and rates.
- [x] Show pending and connected devices, using device names only as user-facing labels rather than proof of identity.
- [x] Support rejection, disconnection, expiration, and fresh pairing after service restart.

Exit condition: an unapproved browser cannot control the desktop, and disconnecting immediately revokes control.

## Phase 4 — Build the mobile touchpad

- [x] Build a responsive dark interface with connection status and explicit controls.
- [ ] Implement relative pointer movement, tap to click, secondary click, and two-finger scrolling.
- [x] Tune sensitivity and message batching for responsive movement.
- [x] Prevent page scrolling and unwanted browser gestures in the touchpad area.
- [ ] Handle touch cancellation, orientation changes, and lost connections without stuck buttons.

Exit condition: the phone works comfortably as a touchpad during normal desktop use.

## Phase 5 — Implement mobile text input

- [x] Toggle the native mobile keyboard by focusing a real text input.
- [x] Handle composition, autocorrection, insertions, and deletions instead of relying only on keydown events.
- [x] Use native mobile Enter and Backspace; remove the separate Send and auxiliary-key toolbar.
- [ ] Test accented text, repeated characters, selection/replacement, and unsupported Unicode cases.
- [x] Keep the touchpad usable when the keyboard is open.

Exit condition: typical searches and short text can be entered reliably, with documented character limitations.

## Phase 6 — Test and harden the MVP

- [ ] Test on an actual Android browser and, when available, iOS Safari; record devices and versions actually tested.
- [ ] Test multiple monitor layouts and desktop scaling.
- [ ] Test network loss, refresh, reconnect, rejected pairing, and invalid messages.
- [ ] Stop remote control when the desktop locks and require a deliberate reconnection policy after unlock.
- [ ] Verify cleanup during extension disable and helper termination, including released keys and buttons.
- [x] Add focused automated tests for pairing/session authorization and input-message validation.
- [x] Document network setup, security properties, troubleshooting, and known limitations.

Exit condition: the documented end-to-end flow works on the tested devices, with no unresolved authorization or lifecycle failures.

## Phase 7 — Prepare publication

- [ ] Write the English README with setup, usage, screenshots, supported GNOME versions, and limitations.
- [ ] Add licensing, attribution, and contribution guidance.
- [x] Produce and inspect the extension ZIP, excluding development-only files.
- [ ] Check the final implementation against current extensions.gnome.org review guidelines.
- [ ] Ensure the maintainer can explain, debug, and maintain the submitted code.
- [ ] Prepare the GitHub repository and release materials.
- [ ] Publish to GitHub and submit to extensions.gnome.org when explicitly requested.

Exit condition: a reproducible, documented release is ready for review and publication.

## Working agreement

### v0.2.0 scope

- [x] Actionable pairing notifications with request-lifecycle cleanup.
- [x] Native preferences and live, configurable sensitivity limits.
- [x] Opt-in trusted browsers, fixed expiry, editable labels, and immediate revocation.
- [x] Separate disconnect, service stop, and forgetting a browser.
- [x] Subtle menu selection/focus colors.
- [x] Preliminary publication review in PUBLICATION.md.
- [x] Physical mobile acceptance of remembered trust and preferences updates; notification actions verified in isolated native checks.
- [x] Finalize the local v0.2.0 release after acceptance.

Automatic startup and automatic post-unlock reconnection remain later-version ideas.

### Current implementation status

v0.2.1 is released locally for GNOME Shell 51, tested on 51.1 with Wayland. It adds actionable pairing notifications, native Settings with live sensitivity limits, opt-in remembered browsers with individual/global revocation, and menu action colors. The user confirmed remembered-browser recovery after service restart and working Settings on the physical phone. The patch release adds manual mobile reconnection without refresh, integrated device rows, and a larger default Settings window. All 45 automated tests, temporary/trusted Chromium recovery checks, and isolated native preferences/notification/lock checks pass. The runtime ZIP is built and inspected. Automatic startup remains deferred; certificate setup, broader compatibility, and publication requirements remain follow-up work. See TESTING.md, CHANGELOG.md, and PUBLICATION.md for evidence and limitations.

Work through phases in order, updating this checklist and recording decisions as they are made. Start with the smallest technical proof; defer visual polish until pairing and input work reliably. A phase is complete only when its exit condition has been checked.
