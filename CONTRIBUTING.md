# Contributing

Target GNOME Shell 51 on Wayland. Keep code, UI text, comments, and documentation in English. See [README.md](README.md) for dependencies, installation, pairing, and limitations.

## Development workflow

1. Make a focused change in the project source. Runtime installation requires no npm dependencies; lint tooling is development-only.
2. Run `npm run lint` and the checks relevant to the change. For protocol, authorization, process, schema, or packaging changes, run `node --test tests/*.test.js`. Browser checks and validation records are in [TESTING.md](TESTING.md).
3. Run `bash scripts/prepare-reload.sh` and execute its printed command in Looking Glass. Later, recall that same command with Up and Enter to build and load the latest source. Reloading stops current remote connections; it does not require logging out.
4. Check the interaction on the phone where relevant and document remaining coverage honestly.

Run native GNOME integration checks only in an isolated compositor and D-Bus session. Never use lock/unlock or compositor termination against the working desktop. Automated server tests use loopback fixtures and do not inject desktop input.

## Lint

Use Node.js 22.13+ on the 22.x line, or Node.js 24+; the current development environment uses Node.js 26. Install the pinned development dependencies and run ESLint:

```sh
npm ci --ignore-scripts
npm run lint
```

The lockfile makes installation reproducible. ESLint checks GJS, browser code and Node tests with separate globals; it applies recommended correctness rules, strict equality and implicit-coercion checks, without a formatting preset. Ignore dist, node_modules and .venv. The command fails on errors or warnings. A single local exception permits the deliberate control-character rejection in the input validator; unused exceptions are errors.

If npm is unavailable but node_modules is already installed, run the identical lint check directly:

```sh
node node_modules/eslint/bin/eslint.js . --max-warnings 0
```

ESLint, its configuration and dependencies are excluded from extension ZIPs. Lint does not replace GJS/Chromium/native tests or the manual review described in [SHEXLI.md](SHEXLI.md).

## Project boundaries

- `extension.js`, `dialogs.js`, `focus.js`, and `input.js` own Shell integration and desktop input.
- `service.js` and shared `dbus.js` manage the separate network process and authenticated private D-Bus connection. `app/service-worker.js` is the child entry point; `app/network-guard.js` and `app/server.js` handle bounded transport and sessions.
- `trusted.js`, `settings.js`, and `preferences/` implement trust storage and native settings.
- `app/web/` contains the mobile client; `limits.js` shares validated bounds.
- `resources.json` declares shipped files and web routes. Update it when adding runtime files; installation and packaging use this manifest.

Preserve peer identity and typed-message checks on both sides of D-Bus, immediate revocation, and stop-on-lock/disable/failure behavior. The network child is not an OS sandbox. Review [SECURITY.md](SECURITY.md) before changing pairing, cookies, input, or process boundaries.

For mobile UI changes, run `npm run test:accessibility` with Chromium installed. Native theme/font and accessible-name checks require an isolated compositor; see [ACCESSIBILITY.md](ACCESSIBILITY.md).

For packaged-build acceptance, use [Install and reload a ZIP](scripts/README.md#install-and-reload-a-zip), rather than the source reload command. The native `tests/install-zip-native.mjs` harness requires SMARTPHONE_RC_ISOLATED_SHELL=1, an isolated bus-address file and a real ZIP path; never point it at the working desktop.

## Packaging and documentation

Build a development ZIP with `bash scripts/package.sh /path/to/output` to avoid overwriting an existing release artifact. Scripts, tests, local credentials, and development loaders are excluded from runtime packages. See [scripts/README.md](scripts/README.md) for entry points.

Update user instructions when behavior changes, [CHANGELOG.md](CHANGELOG.md) for release changes, and [IDEAS.md](IDEAS.md) for proposed features. Keep historical observations in TESTING.md distinct from current instructions. A local ZIP or tag does not imply public publication; distribution work is tracked in [PUBLICATION.md](PUBLICATION.md).

For bug reports, include GNOME and phone/browser versions, relevant actions, expected behavior, and redacted logs. Never include pairing secrets, cookies, private keys, or typed text. Report suspected authorization or credential-disclosure issues privately to the maintainer.
