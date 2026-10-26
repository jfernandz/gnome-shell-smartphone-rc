# Publication readiness

Current implementation: **v0.5.2**. A local ZIP/tag is not approval from extensions.gnome.org. Source is available in the [repository](https://github.com/jfernandz/gnome-shell-smartphone-rc); publication/submission requires a separate request.

## In place

- Native Settings/network setup; declared clipboard use only on explicit request.
- Manifest-based packages with license, runtime assets and schema XML; tests, development loaders and credentials excluded.
- Shell/GTK/child import boundaries, bounded private D-Bus, lifecycle cleanup and transport/authorization regressions.
- Contribution guidance, reproducible lint and documented static-review findings.
- Earlier physical acceptance of ZIP installation and Settings, plus confirmation of the D-Bus migration; final v0.5.2 ZIP acceptance remains pending.

Evidence and limitations: [TESTING.md](TESTING.md), [SECURITY.md](SECURITY.md), [ACCESSIBILITY.md](ACCESSIBILITY.md) and [SHEXLI.md](SHEXLI.md).

Local technical review, load measurements and draft release/reviewer text: [publication review](docs/publication-review.md). The v0.5.2 package includes the scoped lifecycle and authorization refactoring; the earlier review remains historical evidence.

## Before public submission

- [ ] Clarify reviewability of the bundled HTML/browser JavaScript and separate network core with reviewers.
- [ ] Complete first-use mobile certificate-warning checks and final packaged-build acceptance.
- [x] Run a bounded load/recovery check and assess isolation options; broader resource-exhaustion resilience and an OS sandbox remain unestablished.
- [ ] Complete real assistive-technology, high-contrast and physical display-scaling checks.
- [ ] Record current supported devices/browsers and prepare publication screenshots.
- [ ] Complete the maintainer's code/readability review and understanding of security/lifecycle choices.
- [x] Recheck current review guidelines (2026-10-26); bundled-web reviewability remains open.
- [ ] Publish/submit only when requested.

## Recorded reviewer guidance

The [maintainer response](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/4) on 2026-10-26 prefers distributing the core separately, recommends D-Bus, and requests a dedicated directory for separately executed files if bundled. This is guidance, not formal acceptance.

The project retains one package with a private D-Bus child and browser assets under `app/`; Shell/preferences do not import that application core. See [DBUS.md](DBUS.md). Separate distribution remains a possible design change.

The initial 2026-10-25 review consulted the [extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) and [preferences documentation](https://gjs.guide/extensions/development/preferences.html). The current review rechecked the extension guidelines; that does not constitute approval.
