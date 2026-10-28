# Testing

## Current evidence

Recorded on 2026-10-28. Results apply to the stated revision, not every later build.

| Revision/check | Result | Limit |
| --- | --- | --- |
| Automatic startup, unreleased source (2026-10-29) | ESLint and all 128 automated tests pass. Isolated GNOME checks cover actual helper restart after unlock, no pairing popup, Stop surviving unlock and both settings binding in light/dark/enlarged-font preferences. | Uses simulated lock-mode transitions in a disposable compositor; fresh physical login and real screen-lock acceptance remain to be checked. ZIP retains 0.8.0 metadata pending release. |
| v0.8.0 session actions, pre-release source | ESLint and all 124 automated tests pass. Chromium checks pass with default and Noto Sans fonts; confirmed lock/suspend requests traverse the real helper. A 48-file source ZIP passes isolated installation/lifecycle/preferences tests with injected session-action backends. | Automated runs did not lock/suspend the host. The user reports the features work; exhaustive hardware sleep/resume and real logind-policy/inhibitor coverage remain unestablished. |
| v0.7.0 automatic stop, pre-release source | ESLint and all 112 automated tests pass. A 47-file source ZIP passes isolated installation/lifecycle/preferences checks, including configured start, extend/cancel, expiry of connected control and lock cleanup. Native settings pass light/dark/enlarged-font runs. | Test expiry shortens the internal deadline in the isolated Shell. The user reports the timer works. Final versioned-package acceptance remains separate; the source ZIP used the previous version metadata. |
| Earlier development tooling | ESLint, actionlint 1.7.12 and all 105 automated tests pass. Environment setup, CI receipts and release-note generation are covered. | Setup installation commands and draft-release operations were simulated; no system installation or remote release mutation was performed by those tests. |
| Consolidated release tooling | Local tag preparation passes with fresh tagged tests and with imported successful Node 22/24 evidence; ZIP checksums pass. | [The consolidated v0.7.0 run passed](https://github.com/jfernandz/gnome-shell-smartphone-rc/actions/runs/40767357581); v0.8.0 hosted validation remains pending. |
| v0.6.3 | Hosted Node 22/24 CI and Chromium publication preparation pass; all 45 ZIP entries match tagged source. The 320×568/200%-text case passes with CI fonts. | Synthetic approval/audio fixtures; physical-phone and isolated native acceptance of this package remain pending. |
| v0.6.0 | Isolated ZIP installation, Shell lifecycle and preferences checks passed. | Historical native evidence, not acceptance of v0.6.3 or later code. |

See the [v0.6.3 report](docs/publication-review-v0.6.3.md) for hosted artifacts and the [historical journal](docs/testing-history.md) for earlier runs, failures and physical observations. Browser checks are described in [ACCESSIBILITY.md](ACCESSIBILITY.md).

## Automated and browser checks

Prepare the dependencies from [README](README.md#development), then run:

```sh
bash scripts/prepare-env.sh
npm run lint
npm run lint:actions
npm test
npm run test:accessibility
```

The automated suite uses disposable files and ephemeral loopback ports. It covers protocol/authentication, certificates, input/audio lifecycle, helper/D-Bus boundaries, settings, packaging and development tools. Browser tests use temporary Chromium profiles and a pinned test certificate. They do not drive the working desktop or use its browser profile.

Additional browser modes:

```sh
npm run test:browser
npm run test:trusted-browser
node tests/cookie-browser.mjs --trusted --helper
SMARTPHONE_RC_TEST_TRUST_DAYS=7 node tests/cookie-browser.mjs --trusted --helper
SMARTPHONE_RC_ACCESSIBILITY_OUTPUT=dist/accessibility npm run test:accessibility
```

## CI and release checks

- **CI:** PRs, pushes to main and manual runs; ESLint, actionlint and tests on Node 22/24.
- **Release preparation:** version-tag pushes or manual tag selection; resolve/validate the tag → Node 22/24 checks → one verified ZIP and browser captures → the installable/publication ZIP attachments on tag pushes.
- Manual preparation skips release changes. Published releases are not overwritten. Other tag names do not trigger workflows.

Successful test jobs provide receipts and logs tied to the exact tag commit; the generator validates them rather than repeating tests. Missing or stale evidence blocks generation. The draft reuses the prepared ZIP after checksum verification and includes its changelog/comparison link. Artifacts are retained for 30 days. See [publication tooling](scripts/README.md#prepare-a-publication-from-a-tag).

CI uses rolling Arch packages for native dependencies. The disposable browser container alone supplies `--no-sandbox`; its stderr is retained. This is separate from native Shell and physical-phone acceptance. The two `Lint and tests (Node …)` checks can be required by the repository's main-branch ruleset.

## Native checks

Use the isolated launcher with an explicit built ZIP:

```sh
bash scripts/package.sh dist/native-check
node tests/run-isolated-native.mjs dist/native-check/smartphone-rc-0.8.0.zip
```

It creates a headless software-rendered GNOME Shell, private D-Bus session, XDG directories and a test-only evaluation driver; verifies that isolation; then exercises installation/rollback, lifecycle and preferences. It stops only its own process group. Failures retain the profile/logs; preference screenshots default to dist/publication/. Network setup checks need an active private LAN address.

Never point Shell tests at the working desktop's bus, lock/restart that desktop or enable its unsafe mode. Session-action tests must inject lock/power backends and must never invoke real screenShield/logind actions, even inside the isolated compositor. The `SMARTPHONE_RC_ISOLATED_SHELL` flag alone does not establish isolation. Use the launcher unless you have an equivalently verified disposable session.

| Individual harness | Requirements inside that isolated session |
| --- | --- |
| tests/preferences-native.mjs | GJS, staged extension with compiled schemas, memory GSettings; optional theme/font/screenshot variables in [ACCESSIBILITY.md](ACCESSIBILITY.md). |
| tests/network-preferences-native.mjs, tests/network-errors-native.mjs, tests/network-races-native.mjs | GJS, SMARTPHONE_RC_NETWORK_TEST=1 and temporary configuration; setup needs a private LAN address. |
| tests/shell-security-native.mjs | Node, isolated bus file and runtime directory; extension active in that Shell. |
| tests/install-zip-native.mjs | Node, isolated bus file, project ZIP and the launcher's test-driver extension. |

## Optional load check

```sh
SMARTPHONE_RC_SOAK_SECONDS=120 node tests/network-soak.mjs
```

Default: 30 seconds; range: 10–300, followed by 16 seconds of recovery. This Linux-only fixture mixes incomplete TLS connections and HTTPS requests, samples RSS/descriptors, and checks recovery without injecting desktop input. It is not an exhaustive denial-of-service audit.

## Remaining coverage

- Final packaged-build acceptance: installation, approval/certificate warning, lock/Stop cleanup, real volume/mute and output switching.
- Real phones/keyboards, iOS Safari, other applications/IMEs, Xwayland and long sessions/network interruptions.
- Assistive technology, high contrast, display scaling and physical keyboard occlusion.
- Sustained resource exhaustion and native-library review; see [SECURITY.md](SECURITY.md).

Passing tests or creating a tag does not establish EGO approval; see [PUBLICATION.md](PUBLICATION.md).
