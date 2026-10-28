# Contributing

Target GNOME Shell 51 on Wayland. Keep code, UI text, comments and documentation in English. Dependencies and user instructions are in [README.md](README.md).

## Dependency policy

The [README dependency table](README.md#development) is the central inventory.
Classify a dependency by the task that needs it, not by its language or where
it happened to be installed:

- Runtime dependencies support the installed extension and are documented in
  Install and configure. Development tools never enter the runtime manifest.
- Shared lint/test checks run locally and in the corresponding CI jobs with
  the same options. CI installs those tools; actionlint is treated like ESLint.
- Browser, packaging, publication and optional review tools are installed only
  where those tasks run. A manual review tool need not become a CI gate.
- Use the OS package manager for system executables, npm/package-lock.json for
  JavaScript dependencies, and a venv/requirements-review.txt for Python review
  dependencies. Record supported/tested versions; do not add per-tool installers.
- Every new dependency needs an entry explaining its purpose, installation and
  CI use. A temporary diagnostic tool does not silently become a prerequisite.

## Workflow

1. Make a focused change; update the runtime manifest if adding shipped files.
2. Run lint and relevant tests. Protocol, authorization, process, schema or packaging changes require the full `npm test` suite; mobile UI changes also require `npm run test:accessibility` with Chromium.
3. Validate native behavior only in an isolated compositor and D-Bus session. Never lock/restart the working desktop or enable its unsafe mode for tests. See [TESTING.md](TESTING.md) for harness requirements.
4. Record what actually passed and what remains untested. Significant interaction changes also need physical-phone acceptance.

[Source reload](scripts/README.md#reload-source) builds project files; [ZIP install/reload](scripts/README.md#install-and-reload-a-zip) tests a selected package. Both stop existing remote connections. Preserve the stable loader entry points for Looking Glass history.

## Lint

Use `bash scripts/prepare-env.sh` to check dependencies, or add `--install` to prepare them on Arch Linux. Select optional profiles as described in [README](README.md#development).

Use Node.js 22.13+ on 22.x, or 24+:

```sh
npm ci --ignore-scripts
npm run lint
npm run lint:actions
```

Install system development tools, including actionlint, using the [README dependency list](README.md#development). `lint:actions` validates workflow syntax and expressions without executing jobs.

Pinned ESLint dependencies are development-only. Checks cover GJS, browser and Node code with separate globals, recommended correctness rules, strict equality and implicit coercion. Warnings and unused suppression directives fail lint; no formatting preset is imposed. Lint does not replace runtime tests or [manual static-review triage](SHEXLI.md).

If dependencies are installed but npm is unavailable, use `node node_modules/eslint/bin/eslint.js . --max-warnings 0`.

## Module ownership

| Area | Files |
| --- | --- |
| Shell UI and input | `extension.js`, `dialogs.js`, `focus.js`, `input.js` |
| Process owner and shared D-Bus contract | `service.js`, `dbus.js` |
| Network child | `app/service-worker.js`, `app/server.js`, `app/network-guard.js`, `app/session-authorization.js` |
| Mobile client | `app/web/` |
| Settings and trust | `settings.js`, `trusted.js`, `preferences/`, `prefs.js` |
| Shared bounds and packaging | `limits.js`, `resources.json`, `scripts/lib/stage.sh` |

`prefs.js` composes pages from explicit group lists; `preferences/about.js` owns installed/session metadata presentation. Network preference tests inject only the read, discovery and apply operations while using real GTK widgets in the isolated launcher. Temporary authorization owns its private credentials and timer; the server retains HTTP, cookies and WebSocket ownership.

Keep app code out of Shell/preferences imports and Shell/GTK UI out of the child. Preserve peer identity checks, validated typed messages, immediate revocation and stop-on-lock/disable/failure. Review [SECURITY.md](SECURITY.md) before changing authorization, cookies, input or process boundaries.

## Packaging and documentation

Use `bash scripts/package.sh /path/to/output` to preserve existing release ZIPs. Scripts, tests, credentials and development dependencies are excluded from runtime packages.

Update user instructions when behavior changes and [CHANGELOG.md](CHANGELOG.md) for releases. Keep proposals in [IDEAS.md](IDEAS.md), current evidence in [TESTING.md](TESTING.md), and historical observations in its linked archive. Local tags/ZIPs do not imply [publication approval](PUBLICATION.md).

Bug reports should include GNOME/phone/browser versions, steps, expected behavior and redacted logs. Never include pairing links, cookies, private keys or typed text. Report suspected authorization or credential disclosure privately to the maintainer.
