# Testing

## Current evidence

**v0.5.1, 2026-10-26:** all 75 automated tests and ESLint pass. The release ZIP was built and its metadata inspected. Target: GNOME Shell 51, with native observations on 51.1/Wayland.

| Layer | Recorded coverage | Limit |
| --- | --- | --- |
| Automated Node/GJS | Protocol/input validation, browser state, real HTTP/TLS server, authorization/revocation, certificates, subprocess timeout/cancellation/reaping, process failure, D-Bus bounds/identity, schemas and packaging. | Loopback fixtures do not establish physical input or exhaustive resource-exhaustion resilience. |
| v0.5.1 installer | Active/disabled rollback, failed first installation, source-loaded copy, cancellation, private ZIP permissions/removal, and replacement of the original ZIP during validation. | Simulated Shell manager and real temporary files; the native ZIP harness has not been rerun for v0.5.1. |
| v0.5.1 service | Real helper startup/shutdown with a comma in TMPDIR. | Focused D-Bus path regression. |
| v0.5.0 Chromium | Recovery, remembered trust, browser/service restart, revocation and accessibility through the real D-Bus helper. | These browser checks were not rerun for v0.5.1. |
| v0.5.0 isolated Shell | Certificate approval gate, crash/lock cleanup, menu states, pending-startup cancellation, ZIP installation and active-copy rollback. | Separate compositor, settings and D-Bus session; not final v0.5.1 ZIP acceptance. |
| Native preferences | Setup/error recovery, sensitivity, trust, About and focused theme/accessibility checks. | Earlier recorded runs; not rerun for v0.5.1. |
| Physical phone | Android/Chrome LAN control, scrolling, typing, remembered recovery, Settings and lifecycle menu; user confirmed the D-Bus migration works. | Exact migration loading method unspecified; not acceptance of the final v0.5.1 ZIP. |

Detailed observations, including the original compositor-crash investigation and mitigations, are retained in the [historical journal](docs/testing-history.md). Historical commands and pending items may be superseded; use the instructions below for current checks.

## Automated and browser checks

From the repository root, use the dependencies in [README.md](README.md#development):

```sh
npm ci --ignore-scripts
npm run lint
npm test
```

Tests use disposable files and ephemeral loopback ports; they do not require stopping the desktop's service or inject desktop input. Browser tests additionally need Chromium:

```sh
node tests/cookie-browser.mjs
node tests/cookie-browser.mjs --trusted
node tests/cookie-browser.mjs --trusted --helper
SMARTPHONE_RC_TEST_TRUST_DAYS=7 node tests/cookie-browser.mjs --trusted --helper
npm run test:accessibility
```

Browser fixtures use temporary profiles and trust only their generated test certificate's public-key pin. Automatic approval is test-only. They do not alter your normal browser profile or certificate policy. Accessibility assertions and their limits are described in [ACCESSIBILITY.md](ACCESSIBILITY.md).

## Native checks

Use an isolated compositor with separate D-Bus, settings, configuration, data, cache and runtime directories. Never lock/restart the working desktop, enable its unsafe mode, or point these harnesses at its bus. The Shell harnesses require evaluation support configured only inside the isolated instance; the environment flag alone does not provide isolation.

| Harness | Invocation and prerequisites inside the isolated environment |
| --- | --- |
| `tests/preferences-native.mjs` | `GSETTINGS_BACKEND=memory gjs -m tests/preferences-native.mjs /path/to/staged-extension`; stage with compiled schemas using `bash scripts/lib/stage.sh /path/to/staged-extension`. |
| `tests/network-preferences-native.mjs` | `SMARTPHONE_RC_NETWORK_TEST=1 gjs -m tests/network-preferences-native.mjs`; requires a temporary XDG_CONFIG_HOME and an active private LAN address. Creates a certificate. |
| `tests/network-errors-native.mjs` | `SMARTPHONE_RC_NETWORK_TEST=1 gjs -m tests/network-errors-native.mjs`; use a temporary XDG_CONFIG_HOME. |
| `tests/shell-security-native.mjs` | `SMARTPHONE_RC_ISOLATED_SHELL=1 node tests/shell-security-native.mjs /path/to/bus-file /path/to/runtime-directory`; project extension must already be active in the isolated Shell. Exercises lock and helper failure. |
| `tests/install-zip-native.mjs` | `SMARTPHONE_RC_ISOLATED_SHELL=1 node tests/install-zip-native.mjs /path/to/bus-file /path/to/project.zip`; requires the isolated test-driver extension. Replaces only the isolated installation. |

Bus files contain the isolated bus address, not a bus name. The custom test-driver/compositor setup is not a self-contained launcher in this repository; provision and verify isolation before running either Shell harness.

## Remaining coverage

- Rerun the native ZIP harness for v0.5.1, especially disabled-state and first-install rollback; confirm the final ZIP on the physical setup.
- Expand ordinary application, Xwayland, IME, Unicode fallback and long-editing checks.
- Test current Android/browser versions, iOS Safari, network interruptions and long sessions.
- Verify multiple monitors, scaling, orientation, real mobile keyboard occlusion and assistive technology; see [ACCESSIBILITY.md](ACCESSIBILITY.md).
- Complete sustained resource-exhaustion and native-library security assessment; see [SECURITY.md](SECURITY.md).

A passing local suite or tag does not imply publication approval. See [PUBLICATION.md](PUBLICATION.md) and [SHEXLI.md](SHEXLI.md).
