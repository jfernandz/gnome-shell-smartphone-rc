# Publication readiness

Current implementation: **v0.6.0**. A local ZIP/tag is not approval from extensions.gnome.org. Source is available in the [repository](https://github.com/jfernandz/gnome-shell-smartphone-rc); publication/submission requires a separate request.

Current submission preparation: [v0.6.0 artifact, review and maintainer checklist](docs/publication-review-v0.6.0.md).
The GitHub v0.6.0 prerelease is published. The architecture consultation is
complete in the existing Discourse thread, including the maintainer follow-up.
The extension ZIP itself has not yet been submitted to extensions.gnome.org.

## In place

- Native Settings/network setup; declared clipboard use only on explicit request.
- Manifest-based packages with license, runtime assets and schema XML; tests, development loaders and credentials excluded.
- Shell/GTK/child import boundaries, bounded private D-Bus, lifecycle cleanup and transport/authorization regressions.
- Contribution guidance, reproducible lint and documented static-review findings.
- Earlier physical acceptance of ZIP installation and Settings, plus confirmation of the D-Bus migration; final v0.6.0 ZIP and physical volume/output-switch acceptance remain pending.

Evidence and limitations: [TESTING.md](TESTING.md), [SECURITY.md](SECURITY.md), [ACCESSIBILITY.md](ACCESSIBILITY.md) and [SHEXLI.md](SHEXLI.md).

Local technical review, load measurements and draft release/reviewer text: [publication review](docs/publication-review.md). The v0.5.2 package includes the scoped lifecycle and authorization refactoring; the earlier review remains historical evidence.

## Before public submission

- [x] Verify the published v0.6.0 ZIP against its digest, manifest, tag and licenses.
- [x] Repeat pinned static analysis on v0.6.0 and document all six remaining findings.
- [x] Prepare current listing text and synthetic screenshot candidates; archive the redundant follow-up draft.
- [x] Complete the architecture consultation: submit the self-contained ZIP with private D-Bus and separately executed files under app/, following the reviewer guidance in the existing thread.
- [ ] Complete first-use mobile certificate-warning checks and final packaged-build acceptance.
- [x] Run a bounded load/recovery check and assess isolation options; broader resource-exhaustion resilience and an OS sandbox remain unestablished.
- [ ] Complete real assistive-technology, high-contrast and physical display-scaling checks.
- [ ] Record real supported devices/browsers and select final publication screenshots; fresh synthetic candidates are prepared.
- [ ] Complete the maintainer's code/readability review and understanding of security/lifecycle choices.
- [x] Recheck current review guidelines (2026-10-27); architecture consultation completed; approval of the submitted ZIP remains pending.
- [ ] Publish/submit only when requested.

## Recorded reviewer guidance

The [maintainer response](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/4) on 2026-10-26 prefers distributing the core separately, recommends D-Bus, and requests a dedicated directory for separately executed files if bundled. The reply explicitly discusses bundling as an option with that layout. The
[maintainer follow-up](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/5)
confirms the D-Bus/app/ changes and the decision to submit one ZIP. This closes
the architecture consultation; it is not approval of a specific release ZIP.

The project retains one package with a private D-Bus child and browser assets under `app/`; Shell/preferences do not import that application core. See [DBUS.md](DBUS.md). No additional architecture clarification is required before submitting on
this basis. Separate distribution remains the reviewer's preference and may
need revisiting if requested during the actual package review.

The initial 2026-10-25 review consulted the [extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) and [preferences documentation](https://gjs.guide/extensions/development/preferences.html). The current review rechecked the extension guidelines; that does not constitute approval.
