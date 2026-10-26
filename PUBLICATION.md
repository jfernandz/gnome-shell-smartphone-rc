# Publication readiness

Readiness checklist for the current v0.5.1 implementation. The initial internal review on 2026-10-25 consulted the [GNOME Shell Extensions Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) and [Preferences documentation](https://gjs.guide/extensions/development/preferences.html). The checklist has since been updated for the implemented security changes. It is not approval from extensions.gnome.org; recheck the current guidelines before submission.

- [x] Keep GTK/Adwaita imports in preferences and Shell imports in the extension process.
- [x] Use a correctly named GSettings schema under the GNOME extension namespace and ship its XML.
- [x] Include the license and runtime sources/assets; exclude development reload helpers, tests, certificates, private keys, and configuration from the ZIP.
- [x] Keep the development loader out of the runtime extension; it reloads only this extension during development.
- [x] Declare clipboard use in metadata and require a user action to copy a pairing link.
- [x] Stop control on disable/lock and remove notifications, listeners, signals, and timers.
- [ ] Confirm reviewability of the embedded browser interface. The guidelines limit review of HTML/web JavaScript dependencies; acceptance of this architecture needs reviewer clarification.
- [x] Move network serving out of the Shell process, bound private D-Bus application messages, and test crash/parent-exit cleanup.
- [x] Add bounded hostile-transport regressions and connection/resource limits.
- [ ] Complete sustained resource-exhaustion testing and assess OS sandboxing; current checks do not establish resilience against every native/network attack.
- [x] Provide network address/port selection and local certificate generation/renewal in Settings, with a first-start setup prompt.
- [x] Confirm the installation/configuration/control flow from the v0.4.0 ZIP on the physical setup, without the development loader.
- [x] Automate missing OpenSSL/iproute2/prlimit, failed/no-address discovery, partial certificate failure, and occupied-port cases; verify error display and retry controls in native Settings.
- [ ] Complete first-use mobile certificate-warning coverage.
- [x] Publish the [source repository](https://github.com/jfernandz/gnome-shell-smartphone-rc) and add its URL to metadata.
- [x] Document contribution and development guidance in [CONTRIBUTING.md](CONTRIBUTING.md).
- [x] Add focused Chromium keyboard/reflow/contrast checks and native accessible-name/theme/font checks; record evidence in [ACCESSIBILITY.md](ACCESSIBILITY.md).
- [ ] Complete real assistive-technology, high-contrast and physical display-scaling checks.
- [ ] Prepare publication screenshots, current supported-device records, and a final code/readability audit.
- [ ] Have the maintainer review and understand all submitted code and its security/lifecycle choices.
- [ ] Request publication separately, then publish to GitHub and submit to extensions.gnome.org.

- [x] Add reproducible ESLint correctness checks for GJS, browser code and Node tests; review findings and verify lint tooling stays out of the ZIP.

## Static analysis

See [SHEXLI.md](SHEXLI.md) for reproducible tooling and the disposition of all seven v0.4.5 findings. v0.4.6 addresses synchronous Shell file reads/cleanup; six findings remain for documented version/schema limitations, separate entry points, lifecycle ownership and manual clipboard review. No analyzer rule is suppressed, and the released v0.4.5 ZIP is unchanged.


## Maintainer feedback and process layout — v0.5.0

The [maintainer response](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/4) on 2026-10-26 prefers distributing the core separately, recommends D-Bus, and says that separately executed files should live in a dedicated directory if they remain bundled. This is guidance, not formal acceptance of the ZIP.

v0.5.0 keeps a single package, replaces ipc.js with private authenticated D-Bus, and puts the network child/server/guard and browser assets in app/. Shared safe modules stay at the root; neither extension.js nor prefs.js statically imports the application core. Application code does not import Shell/desktop UI libraries. Regression checks enforce these boundaries. Separate installation remains a possible future distribution decision, not a new requirement for users of this implementation.
