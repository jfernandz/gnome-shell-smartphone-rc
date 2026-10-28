# Contributing

Target GNOME Shell 51 on Wayland. Keep code, UI text and documentation in English. [README](README.md#development) is the dependency inventory; [scripts/README.md](scripts/README.md) covers tooling.

## Workflow

1. Check dependencies with `bash scripts/prepare-env.sh`; add --install and optional profiles when needed.
2. Make a focused change. Update resources.json when adding runtime files.
3. Run ESLint/actionlint and relevant tests. Protocol, authorization, process, schema or packaging changes require the full npm test suite; mobile UI changes also require the Chromium accessibility suite.
4. Record actual results and untested behavior in [TESTING.md](TESTING.md). Interaction changes need physical-phone acceptance.

```sh
npm run lint
npm run lint:actions
npm test
npm run test:accessibility  # For mobile UI changes.
```

Run native validation only in the [isolated launcher](TESTING.md#native-checks). Never lock/restart the working desktop, use its bus or enable its unsafe mode for tests. Source/ZIP development reloads stop existing remote connections.

## Dependencies

- Runtime dependencies support the installed extension; development tools stay out of its ZIP.
- Shared checks use the same options locally and in CI. CI installs the tools it runs, including ESLint and actionlint.
- Browser, publication and optional review tools belong only in the environments that use them; a manual review need not become a CI gate.
- Use OS packages for system executables, npm/package-lock.json for JavaScript, and a venv/requirements-review.txt for optional Python review. Document purpose, installation and supported/tested versions in README.
- Use the shared prepare-env.sh; do not add per-tool installers or silently turn diagnostic tools into prerequisites.

## Module ownership

| Area | Files |
| --- | --- |
| Shell UI/input | extension.js, dialogs.js, focus.js, input.js, volume.js |
| Process/D-Bus | service.js, dbus.js |
| Network child | app/service-worker.js, app/server.js, app/network-guard.js, app/session-authorization.js |
| Mobile client | app/web/ |
| Settings/trust | settings.js, trusted.js, prefs.js, preferences/ |
| Packaging/bounds | resources.json, limits.js, scripts/lib/stage.sh |

Keep app code out of Shell/preferences imports and Shell/GTK UI out of the child. Preserve authenticated peers, independent validation, revocation and stop-on-lock/disable/failure. Read [SECURITY.md](SECURITY.md) before changing authorization, credentials, input or process boundaries.

## Packaging and documentation

Build into a separate output directory to preserve release artifacts. Preserve the stable [source reload](scripts/README.md#reload-source) and [ZIP install](scripts/README.md#install-and-reload-a-zip) entry points used by Looking Glass history.

Put user instructions in README, verification evidence in TESTING, proposals in IDEAS, release changes in CHANGELOG and distribution work in PUBLICATION. Historical reports remain dated; they do not establish current acceptance. GitHub drafts and EGO submission follow the [publication workflow](PUBLICATION.md).

Bug reports should include GNOME/browser versions, steps, expected behavior and redacted logs. Never include private keys, pairing links, cookies or typed text. Report suspected credential disclosure privately to the maintainer.
