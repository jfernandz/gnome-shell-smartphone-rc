# Publication readiness

Preliminary review for v0.2.0, checked on 2026-10-25 against the [GNOME Shell Extensions Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) and [Preferences documentation](https://gjs.guide/extensions/development/preferences.html). This is an internal review, not approval from extensions.gnome.org.

- [x] Keep GTK/Adwaita imports in preferences and Shell imports in the extension process.
- [x] Use a correctly named GSettings schema under the GNOME extension namespace and ship its XML.
- [x] Include the license and runtime sources/assets; exclude development reload helpers, tests, certificates, private keys, and configuration from the ZIP.
- [x] Keep the development loader out of the runtime extension; it reloads only this extension during development.
- [x] Declare clipboard use in metadata and require a user action to copy a pairing link.
- [x] Stop control on disable/lock and remove notifications, listeners, signals, and timers.
- [ ] Confirm reviewability of the embedded browser interface. The guidelines limit review of HTML/web JavaScript dependencies; acceptance of this architecture needs reviewer clarification.
- [x] Move network serving out of the Shell process, bound private IPC, and test crash/parent-exit cleanup.
- [x] Add bounded hostile-transport regressions and connection/resource limits.
- [ ] Complete sustained resource-exhaustion testing and assess OS sandboxing; current checks do not establish resilience against every native/network attack.
- [ ] Replace manual certificate/network setup with an installation experience suitable for public users.
- [ ] Add the actual repository URL to metadata after creating the public repository; do not invent one.
- [ ] Complete accessibility/theme checks, screenshots, contribution guidance, supported-device records, and a final code/readability audit.
- [ ] Have the maintainer review and understand all submitted code and its security/lifecycle choices.
- [ ] Request publication separately, then publish to GitHub and submit to extensions.gnome.org.
