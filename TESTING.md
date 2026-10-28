# Testing

## Current evidence

**v0.6.3, 2026-10-28:** Chromium remembered-browser/accessibility checks pass
with Noto Sans, including the 320×568 viewport at 200% text that failed on
hosted v0.6.2. The narrow portrait card now uses smaller gaps and safe top
placement. Layout checks wait for its opening animation before measuring.
Physical-phone verification and hosted v0.6.3 acceptance remain pending.

**Publication CI follow-up, 2026-10-28:** The first hosted v0.6.2 preparation
passed automated tests, packaging and ZIP validation, but Chromium never
exposed DevTools. The retained log showed a startup timeout; the old harness
did not retain browser stderr, so it does not establish the exact launch error.
The CI wrapper now uses a container-only `--no-sandbox` invocation and retains
startup stderr. Local Chromium checks pass with default sandbox settings;
a synthetic exit-42 browser fixture verifies immediate exit/stderr reporting.
The next hosted run confirmed Chromium starts, then exposed a genuine
320×568/200%-text overflow with Noto Sans. That release tag remains unchanged;
the layout correction is included in v0.6.3.

**v0.6.1, 2026-10-28:** The Controls-panel revision passes ESLint, all
93 automated tests and Chromium remembered-browser/accessibility checks
through the real D-Bus helper.
The direct-controls card fits without scrolling at 360×800, 320×568, 568×320,
844×390, 568×240 and 844×180, plus 200% text at 568×320 and 320×568.
Tests cover hold-to-right-click and cancellation, 44-pixel targets,
dismissal/focus restoration, accessible labels
and editor focus/text/selection across rotation and short keyboard viewports.
Physical-phone use, real Android keyboard behavior and display cutouts
remain pending. No release ZIP or isolated Shell acceptance was run for this
revision. Screenshots are available from the optional browser output folder.

**v0.6.0, 2026-10-27:** ESLint and all 91 automated tests pass. The ZIP
contains exactly 45 manifest files and passes the isolated native
installation/lifecycle/preferences harness. Volume regressions cover bounded
commands, local updates, output switches, stale-output rejection, missing
outputs, amplified-volume capping, coalescing and observer/timer cleanup.
Chromium temporary-cookie and remembered-browser/accessibility checks pass
through the real D-Bus helper, including synthetic mixer-state delivery and
volume/mute command return. The isolated Shell verifies native mixer observer
creation and lifecycle cleanup; actual audio changes, physical-phone use and
hardware output switching remain pending. Details and older evidence are in
the [historical journal](docs/testing-history.md). Target: GNOME Shell 51,
with native observations on 51.1/Wayland.

| Layer | Recorded coverage | Limit |
| --- | --- | --- |
| Automated Node/GJS | Protocol/input validation, browser state, real HTTP/TLS server, authorization/revocation, certificates, subprocess timeout/cancellation/reaping, process failure, D-Bus bounds/identity, schemas and packaging. | Loopback fixtures do not establish physical input or exhaustive resource-exhaustion resilience. |
| v0.6.0 installer | Active/disabled rollback, failed first installation, source-loaded copy, cancellation, private ZIP permissions/removal, and replacement of the original ZIP during validation. | Native checks pass with the corrected development installer. |
| v0.6.0 service | Real helper startup/shutdown with a comma in TMPDIR. | Focused D-Bus path regression. |
| v0.6.0 runtime Chromium | Recovery, remembered trust, browser/service restart, revocation and accessibility through the real D-Bus helper. | Synthetic mixer fixture; actual audio and physical-phone acceptance remain pending. |
| v0.6.0 isolated Shell | Certificate approval gate, crash/lock cleanup, menu states, pending-startup cancellation, ZIP installation, active/disabled/first-install rollback and original ZIP replacement. | Real v0.6.0 ZIP; native mixer observer creation and cleanup pass; working desktop untouched. |
| Native preferences | Five tabs and keyboard focus, 420-pixel layouts, certificate metadata/renewal/failure preservation, delayed Network operations, sensitivity, trust and About link/icon accessibility. | Isolated light/dark/enlarged-font checks; real assistive technology remains unvalidated. |
| Physical phone | Android/Chrome LAN control, scrolling, typing, remembered recovery, Settings and lifecycle menu; user confirmed the D-Bus migration works. | Exact migration loading method unspecified; not acceptance of the final v0.5.5 ZIP. |

Detailed observations, including the original compositor-crash investigation and mitigations, are retained in the [historical journal](docs/testing-history.md). Historical commands and pending items may be superseded; use the instructions below for current checks.

## Automated and browser checks

GitHub Actions runs lint and the full `npm test` suite on pull requests,
pushes to `main` (including merges), and all pushed tags. It can also be run
manually from the Actions tab. The `CI` workflow tests Node.js 22 and 24 in
an Arch Linux container to provide libsoup 3.8+ and the native GJS/packaging
dependencies. Arch packages track current releases rather than a frozen
runtime. ZIP contents and schemas are checked by the automated suite.
Browser, isolated GNOME Shell and physical-phone checks remain separate.
To require CI before merging, configure the two `Lint and tests (Node …)`
checks as required status checks in the GitHub ruleset for `main` after
the first workflow run.

The Node.js 24 job also builds a ZIP, available as the
`smartphone-rc-package` workflow artifact for 14 days (including PR runs).
After both Node.js jobs pass, a pushed `v*` tag creates a GitHub Release
in draft with that ZIP and automatically generated release notes. The tag
must equal `v` followed by the version in both `metadata.json` and
`package.json`, for example `v0.6.0`. Other tags only run CI.
Re-running the tag workflow refreshes the ZIP of an existing draft; it
refuses to change a published release. Review and publish the draft manually
when ready. This workflow does not submit to extensions.gnome.org.

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
node tests/run-isolated-native.mjs dist/smartphone-rc-0.6.0.zip
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

- Confirm the final v0.6.0 ZIP on the physical setup, including local/remote volume, mute, headphones/Bluetooth output changes, missing outputs and stop/lock cleanup.
- Expand ordinary application, Xwayland, IME, Unicode fallback and long-editing checks.
- Test current Android/browser versions, iOS Safari, network interruptions and long sessions.
- Verify multiple monitors, scaling, orientation, real mobile keyboard occlusion and assistive technology; see [ACCESSIBILITY.md](ACCESSIBILITY.md).
- Complete sustained resource-exhaustion and native-library security assessment; see [SECURITY.md](SECURITY.md).

A passing local suite or tag does not imply publication approval. See [PUBLICATION.md](PUBLICATION.md) and [SHEXLI.md](SHEXLI.md).
