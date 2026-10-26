# Testing

## Current evidence

**v0.5.2, 2026-10-26:** all 85 automated tests and ESLint pass. The ZIP contains exactly 39 manifest files. Chromium covers temporary and remembered authorization through the real helper, including accessibility. The isolated native launcher covers ZIP installation, lifecycle, preferences and repeated-state resource preservation. See the [historical journal](docs/testing-history.md) for scope and remaining coverage. Target: GNOME Shell 51, with native observations on 51.1/Wayland.

| Layer | Recorded coverage | Limit |
| --- | --- | --- |
| Automated Node/GJS | Protocol/input validation, browser state, real HTTP/TLS server, authorization/revocation, certificates, subprocess timeout/cancellation/reaping, process failure, D-Bus bounds/identity, schemas and packaging. | Loopback fixtures do not establish physical input or exhaustive resource-exhaustion resilience. |
| v0.5.2 installer | Active/disabled rollback, failed first installation, source-loaded copy, cancellation, private ZIP permissions/removal, and replacement of the original ZIP during validation. | Native checks pass with the corrected development installer. |
| v0.5.2 service | Real helper startup/shutdown with a comma in TMPDIR. | Focused D-Bus path regression. |
| v0.5.2 Chromium | Recovery, remembered trust, browser/service restart, revocation and accessibility through the real D-Bus helper. | Synthetic Chromium, not final physical-phone acceptance. |
| v0.5.2 isolated Shell | Certificate approval gate, crash/lock cleanup, menu states, pending-startup cancellation, ZIP installation, active/disabled/first-install rollback and original ZIP replacement. | Real v0.5.2 ZIP; repeated states preserve pending approval, focus and keyboard; working desktop untouched. |
| Native preferences | Setup/error recovery, sensitivity, trust, About and focused theme/accessibility checks. | Rerun in isolated light/dark/enlarged-font sessions. Network windows emit a GTK focus-out warning; assertions pass. |
| Physical phone | Android/Chrome LAN control, scrolling, typing, remembered recovery, Settings and lifecycle menu; user confirmed the D-Bus migration works. | Exact migration loading method unspecified; not acceptance of the final v0.5.2 ZIP. |

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

## Optional load check

```sh
SMARTPHONE_RC_SOAK_SECONDS=120 node tests/network-soak.mjs
```

The duration defaults to 30 seconds (allowed 10–300), followed by 16 seconds of recovery. This Linux-only test stages a disposable real TLS helper, mixes incomplete handshakes with HTTPS, samples `/proc` RSS/descriptors, and verifies recovery and descriptor release. It never injects desktop input. The recorded two-minute run is in the review report; it is not an exhaustive denial-of-service test.

## Native checks

Run the self-contained launcher from the repository root:

```sh
node tests/run-isolated-native.mjs dist/smartphone-rc-0.5.2.zip
```

It creates its own software-rendered headless Shell, private bus, XDG directories and test-only evaluation driver, verifies their identity, then runs ZIP, lifecycle and preferences checks. It terminates only its own process group and attempts private-profile cleanup; failures retain logs. Preferences screenshots go to dist/publication/. It needs the native/browser dependencies, Python 3, `gdbus`, `dbus-run-session`, `gnome-shell`, unzip/coreutils and `fusermount3` for private FUSE cleanup. Network setup additionally needs an active private LAN address.

Use an isolated compositor with separate D-Bus, settings, configuration, data, cache and runtime directories. Never lock/restart the working desktop, enable its unsafe mode, or point these harnesses at its bus. The Shell harnesses require evaluation support configured only inside the isolated instance; the environment flag alone does not provide isolation.

| Harness | Invocation and prerequisites inside the isolated environment |
| --- | --- |
| `tests/preferences-native.mjs` | `GSETTINGS_BACKEND=memory gjs -m tests/preferences-native.mjs /path/to/staged-extension`; stage with compiled schemas using `bash scripts/lib/stage.sh /path/to/staged-extension`. |
| `tests/network-preferences-native.mjs` | `SMARTPHONE_RC_NETWORK_TEST=1 gjs -m tests/network-preferences-native.mjs`; requires a temporary XDG_CONFIG_HOME and an active private LAN address. Creates a certificate. |
| `tests/network-errors-native.mjs` | `SMARTPHONE_RC_NETWORK_TEST=1 gjs -m tests/network-errors-native.mjs`; use a temporary XDG_CONFIG_HOME. |
| `tests/shell-security-native.mjs` | `SMARTPHONE_RC_ISOLATED_SHELL=1 node tests/shell-security-native.mjs /path/to/bus-file /path/to/runtime-directory`; project extension must already be active in the isolated Shell. Exercises lock and helper failure. |
| `tests/install-zip-native.mjs` | `SMARTPHONE_RC_ISOLATED_SHELL=1 node tests/install-zip-native.mjs /path/to/bus-file /path/to/project.zip`; requires the isolated test-driver extension. Replaces only the isolated installation. |

Bus files contain the isolated bus address, not a bus name. The launcher provisions the test driver and verifies isolation. Invoke individual Shell harnesses only inside an equivalently verified disposable session.

## Remaining coverage

- Review the corrected development installer and confirm the final ZIP on the physical setup.
- Expand ordinary application, Xwayland, IME, Unicode fallback and long-editing checks.
- Test current Android/browser versions, iOS Safari, network interruptions and long sessions.
- Verify multiple monitors, scaling, orientation, real mobile keyboard occlusion and assistive technology; see [ACCESSIBILITY.md](ACCESSIBILITY.md).
- Complete sustained resource-exhaustion and native-library security assessment; see [SECURITY.md](SECURITY.md).

A passing local suite or tag does not imply publication approval. See [PUBLICATION.md](PUBLICATION.md) and [SHEXLI.md](SHEXLI.md).
