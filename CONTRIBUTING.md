# Contributing

Target GNOME Shell 51 on Wayland. Keep code, UI text, comments, and documentation in English. See [README.md](README.md) for dependencies, installation, pairing, and limitations.

## Development workflow

1. Make a focused change in the project source. No npm dependencies are required.
2. Run the checks relevant to the change. For protocol, authorization, process, schema, or packaging changes, run `node --test tests/*.test.js`. Browser checks and validation records are in [TESTING.md](TESTING.md).
3. Run `bash scripts/prepare-reload.sh` and execute its printed command in Looking Glass. Later, recall that same command with Up and Enter to build and load the latest source. Reloading stops current remote connections; it does not require logging out.
4. Check the interaction on the phone where relevant and document remaining coverage honestly.

Run native GNOME integration checks only in an isolated compositor and D-Bus session. Never use lock/unlock or compositor termination against the working desktop. Automated server tests use loopback fixtures and do not inject desktop input.

## Project boundaries

- `extension.js`, `dialogs.js`, `focus.js`, and `input.js` own Shell integration and desktop input.
- `service.js`, `service-worker.js`, and `ipc.js` manage the separate network process and private IPC; `network-guard.js` and `server.js` handle bounded transport and sessions.
- `trusted.js`, `settings.js`, and `preferences/` implement trust storage and native settings.
- `web/` contains the mobile client; `limits.js` shares validated bounds.
- `resources.json` declares shipped files and web routes. Update it when adding runtime files; installation and packaging use this manifest.

Preserve authorization checks on both sides of IPC, immediate revocation, and stop-on-lock/disable/failure behavior. The network child is not an OS sandbox. Review [SECURITY.md](SECURITY.md) before changing pairing, cookies, input, or process boundaries.

## Packaging and documentation

Build a development ZIP with `bash scripts/package.sh /path/to/output` to avoid overwriting an existing release artifact. Scripts, tests, local credentials, and development loaders are excluded from runtime packages. See [scripts/README.md](scripts/README.md) for entry points.

Update user instructions when behavior changes, [CHANGELOG.md](CHANGELOG.md) for release changes, and [IDEAS.md](IDEAS.md) for proposed features. Keep historical observations in TESTING.md distinct from current instructions. A local ZIP or tag does not imply public publication; distribution work is tracked in [PUBLICATION.md](PUBLICATION.md).

For bug reports, include GNOME and phone/browser versions, relevant actions, expected behavior, and redacted logs. Never include pairing secrets, cookies, private keys, or typed text. Report suspected authorization or credential-disclosure issues privately to the maintainer.
