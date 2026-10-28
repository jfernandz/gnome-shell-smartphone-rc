# Project scripts

Run from the repository root. Development scripts and backups are excluded from the runtime ZIP.

| Command | Purpose |
| --- | --- |
| `bash scripts/install.sh` | Install source runtime files and compile schemas for the next login. |
| `node scripts/prepare-publication.mjs vX.Y.Z [new-output-directory]` | Prepare tagged ZIP, checks, synthetic mobile screenshots, icon, notes and publication evidence; defaults to dist/publication-vX.Y.Z. |
| `bash scripts/package.sh [output-directory]` | Build the versioned ZIP; defaults to dist/. Use another directory to preserve released artifacts. |
| `bash scripts/prepare-reload.sh` | Print a reusable Looking Glass command that builds and loads fresh source. |
| `bash scripts/prepare-zip-install.sh [zip-path]` | Select an existing ZIP and print a reusable install/reload command. Without a path, select the most recently modified ZIP under dist/, including review/. |

Installation and packaging share the runtime manifest through `lib/stage.sh` and `lib/runtime-files.js`. The internal `prepare-reload.sh --build-only` interface stages a snapshot and prints its path.

## Reload source

Run `bash scripts/prepare-reload.sh`. Open Looking Glass with **Alt+F2**, `lg`, Enter, and paste the printed command. Later, recall that command with Up and Enter: `reload.js` builds a fresh source snapshot on each call. Close the console with Esc.

Reload replaces only this extension and stops its service; start control manually afterwards. Keep the stable `scripts/reload.js` entry point for existing console history. Use an isolated Shell for native tests; see [TESTING.md](../TESTING.md#native-checks).

## Install and reload a ZIP

```sh
bash scripts/prepare-zip-install.sh /path/to/extension.zip
```

The selector verifies the UUID, writes a private selection record, and prints a stable Looking Glass command. It does not build or install anything. For later archives, rerun the selector and recall the same console command with Up and Enter. Selection uses Node.js and unzip; the installer also needs unzip, `gnome-extensions` and coreutils (`mktemp`, `cp`, `mv`).

Explicit calls are supported:

```js
await (await import("file:///absolute/path/to/project/scripts/install-zip.js")).installZip("/absolute/path/to/extension.zip")
```

Close Settings before updating and reopen it afterwards. `install-zip.js`:

1. Copies the ZIP into a mode-0700 cache transaction; the copy is mode 0600. It validates metadata/entry point and installs using that same copy. Do not edit the original in place while the initial copy is being made.
2. Backs up any installed directory, unloads this extension, and runs `gnome-extensions install --force --print-uuid` into the normal per-user directory.
3. Loads the installed files through a fresh symlink import alias to avoid cached dependency URLs. No project runtime source is built or loaded. Successful installation enables the extension.
4. On failure after unloading, attempts to restore the old files and enabled/disabled settings, including for a failed first installation. A previously loaded source copy can also be restored. Rollback failure reports the backup location.

Settings, certificates and remembered devices are outside the replaced directory. The GNOME 51 loader clears only this UUID's private numeric-version reload guard. It does not invalidate the global module cache. The normal installed directory is still used at the next login. The helper module itself is also cached: after editing its source, use a fresh import URI or a new isolated Shell session to test the changes.

External installer commands use the shared GIO subprocess helper with a 30-second timeout per command and direct-child reaping. Pass `installZip(path, {cancellable})` with a `Gio.Cancellable` to cancel copying/commands; cancellation is also checked before and after loading. Rollback ignores the cancelled token and has its own command timeouts. These are per-step bounds, not a deadline for the entire transaction.

## Cache cleanup

The private ZIP copy is deleted on completion. Backups, failed installations and import aliases remain under `$XDG_CACHE_HOME/smartphone-rc/zip-install-*` (normally `~/.cache/smartphone-rc/`); source snapshots use `build-*` in the same cache.

Do not prune these by age or by checking only the active alias: Shell can import modules lazily, and preferences may still use older files. There is no reliable cross-process reference inventory. For safe manual cleanup, close preferences, end every GNOME session using these files, and remove obsolete transactions/snapshots from another session. Keep recovery backups you need and leave the normal installed extension directory intact. Closing Looking Glass alone does not make its imports unused. Empty or validation-only transaction directories may remain too.

## Prepare a publication from a tag

```sh
node scripts/prepare-publication.mjs v0.6.1
```

The generator archives the exact local tag commit into a private temporary
directory, validates both version fields, runs the tagged automated and
Chromium remembered-browser/accessibility suites, and builds a ZIP. Every ZIP
entry must match the tagged runtime manifest and source bytes. Current working
files, including uncommitted changes, do not enter the release artifact.

Requirements: the native/test dependencies in README, Node.js 22.13+ on 22.x or
24+, git, tar, unzip, Chromium and ImageMagick (`magick`). Set
`SMARTPHONE_RC_CHROMIUM_BIN` for a different Chromium executable. The tag must
contain the screenshot harness and its direct-controls candidate filenames
(v0.6.1 onward); unsupported layouts fail explicitly rather than substituting
current working files. This executes code from the selected tag; use project
tags you trust. The script does not install npm dependencies or run ESLint,
static analysis or a native Shell session.

Output includes the installable ZIP, SHA256SUMS, machine-readable evidence,
REVIEW.md, release notes, a listing draft, a transparent PNG icon, logs and all
browser captures. The two numbered PNGs are publication candidates: portrait
with controls open and landscape with controls closed. They are synthetic
loopback-fixture captures without browser chrome, LAN addresses or pairing
links; real-device and packaged native acceptance remain separate. Other
harness captures may contain test-only editor text.

An existing output directory is never overwritten: pass a new destination to
repeat a run. Failures retain logs and an INCOMPLETE.txt marker; successful
runs remove it. Temporary source, certificates and browser profiles are
cleaned up. Nothing is installed, pushed, published or sent to reviewers.
Review the generated text and images before uploading them.

The **Publication preparation** GitHub Actions workflow also runs on pushed
`v*` tags, or manually with an existing version tag. It uses current tooling
from the default branch and archives the selected release tag, then retains
the bundle for 30 days. Chromium runs as an unprivileged user in its disposable
container. Only that CI wrapper supplies `--no-sandbox` to avoid requiring
host namespace privileges; local invocations keep Chromium's
default sandbox. The wrapper also retains browser stderr in
`logs/chromium-startup.txt`, including when running an older tag's harness.
Failed steps print the tail of their logs to the Actions console.
The first hosted run reached browser startup but timed out before DevTools;
the container-browser correction still requires a hosted rerun.
The separate CI workflow continues to create GitHub draft releases.
