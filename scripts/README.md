# Project scripts

Run from the repository root. Scripts, tests and development dependencies are excluded from the runtime ZIP.

| Command | Purpose |
| --- | --- |
| `bash scripts/prepare-env.sh` | Check base development dependencies. Add --install to install them on Arch Linux. |
| `bash scripts/install.sh` | Install source files and compile schemas for the next login. |
| `bash scripts/package.sh [output-directory]` | Build a versioned ZIP; defaults to dist/. |
| `bash scripts/prepare-reload.sh` | Print a reusable source-reload command for Looking Glass. |
| `bash scripts/prepare-zip-install.sh [zip-path]` | Select a ZIP and print a reusable install/reload command. |
| `node scripts/prepare-publication.mjs vX.Y.Z [new-output-directory]` | Prepare an exact tag's verified ZIP, captures, icon, notes and evidence. |

## Prepare the development environment

```sh
bash scripts/prepare-env.sh
bash scripts/prepare-env.sh --install --publication
```

Default/`--check` installs nothing. It checks commands, supported Node, GNOME Shell 51, libsoup 3.8+, GIO TLS, GTK 4/libadwaita and npm dependencies. Missing or incompatible dependencies cause a nonzero exit.

| Optional profile | Adds |
| --- | --- |
| `--browser` | Chromium, Noto Sans and fontconfig; respects SMARTPHONE_RC_CHROMIUM_BIN. |
| `--publication` | Browser tools, ImageMagick, gh and Python. |
| `--native` | Python, isolated D-Bus tools, FUSE cleanup and which. |
| `--review` | Python/pip and the pinned review packages in .venv. |
| `--all` | Every profile. |

`--install` uses pacman with its normal confirmation prompt, then `npm ci --ignore-scripts`. Review packages go into .venv, created only if needed. Run as your normal user; only pacman uses sudo. Check mode works on other Linux distributions with the required tools; automatic installation supports pacman.

Browser checks reject a missing Noto Sans installation that resolves to a fallback font. Review checks compare venv versions with requirements-review.txt. Setup does not install/reload the extension, run native tests or authenticate GitHub. The full dependency inventory is in [README](../README.md#development).

## Reload source

Run `bash scripts/prepare-reload.sh`, open Looking Glass with **Alt+F2**, `lg`, Enter, and paste the printed command. On later updates, recall that command with Up: `reload.js` builds a fresh source snapshot each time. Close the console with Esc.

Reload replaces only this extension and stops remote connections. Start control manually afterwards. Keep the stable scripts/reload.js entry point for console history. Use [isolated tests](../TESTING.md#native-checks) for native validation.

## Install and reload a ZIP

```sh
bash scripts/prepare-zip-install.sh /path/to/smartphone-rc-0.6.3.zip
```

Without a path, the selector chooses the most recently modified ZIP anywhere under dist/. Pass an explicit installable ZIP when dist/ also contains publication bundles. It verifies the UUID and prints a stable Looking Glass command; it does not build or install anything itself. To change archives, rerun the selector and recall the same console command.

Close Settings before updating and reopen afterwards. The installer:

1. Validates and installs from one private ZIP snapshot, so replacement of the original archive cannot change the installed bytes.
2. Backs up installed files and enablement, unloads this extension, installs, and loads fresh aliases of the installed modules.
3. Restores previous files/enablement on failure, including failed first installs and previously disabled copies.

Commands have 30-second deadlines and support cancellation. Direct calls can pass a Gio.Cancellable:

```js
await (await import("file:///absolute/path/to/project/scripts/install-zip.js")).installZip("/absolute/path/to/extension.zip")
```

## Cache cleanup

The private ZIP copy is removed after the transaction. Source snapshots, backups and module aliases remain under `$XDG_CACHE_HOME/smartphone-rc/` (normally `~/.cache/smartphone-rc/`).

Do not delete them by age: Shell and Settings may import files lazily. Close Settings and end every GNOME session using these files before removing obsolete build-* or zip-install-* directories from another session. Keep recovery backups you need; leave the normal installed extension directory intact.

## Prepare a publication from a tag

```sh
node scripts/prepare-publication.mjs v0.6.3
```

The generator archives the local tag into a private temporary directory, checks versions, runs tagged tests, builds a ZIP and verifies every packaged file against the tagged manifest/source. Chromium then runs the tagged remembered-browser/accessibility suite and saves synthetic captures. Current working files do not enter the release ZIP.

Requirements are in [README](../README.md#development); select the publication profile. Supported tags need the direct-controls screenshot harness/candidate filenames (v0.6.1 onward). Unsupported layouts fail explicitly; old tags retain their original UI and test failures. Only execute tags you trust.

Output defaults to dist/publication-vX.Y.Z/ and includes:

- Installable ZIP, runtime file list and SHA256SUMS.
- Portrait-controls and landscape-touchpad candidates, all diagnostic captures and a transparent 128×128 icon.
- Version-specific changelog plus commit-comparison link, listing draft, REVIEW.md, evidence.json, logs and source documentation.

Existing output directories are never overwritten. A failed run retains logs and INCOMPLETE.txt; a successful run removes that marker. Temporary source, certificates and browser profiles are cleaned up. Captures use synthetic loopback approval/audio and contain no browser address bar or pairing link; diagnostic captures may contain test-only editor text.

For CI, `--checks-from directory` accepts trusted results from successful Node 22/24 jobs for the exact tag commit:

```sh
node scripts/prepare-publication.mjs v0.6.3 dist/publication \
  --checks-from dist/release-checks
```

Each release-checks-node-22/24 directory must contain evidence.json, lint.txt and automated-tests.txt. Missing, stale or unsuccessful evidence fails before output is created. Valid evidence is retained and replaces the repeated test run. Without it, local runs execute tagged tests and report lint as pending. The generator does not install dependencies or perform native Shell/static review.

## GitHub automation

**CI** handles PR/main/manual lint and tests. **Release preparation** handles version tags or manual preparation of an existing tag:

1. Resolve the tag and run lint/tests on Node 22 and 24.
2. Reuse those results to build and verify one publication ZIP and run browser checks.
3. On tag pushes, verify checksums and attach that exact ZIP, selected images, icon, notes, checksums and the full bundle to a draft. Its body includes the tagged changelog and comparison link.

Manual runs skip draft changes; published releases are never overwritten. Artifacts are retained for 30 days under **Actions → Release preparation → run → Summary → Artifacts**. The workflow uses current tooling from the default branch and runtime/test source from the selected tag. CI bootstrap declares packages directly to support checkout and older tags.

Chromium runs unprivileged in the disposable container with a CI-only `--no-sandbox` wrapper. Local defaults remain unchanged. Browser stderr is retained in logs/chromium-startup.txt; failing logs are also printed to Actions. Hosted validation of the consolidated workflow is pending; see [TESTING.md](../TESTING.md). No workflow submits to extensions.gnome.org or publishes a draft automatically.
