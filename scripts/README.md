# Project scripts

Run from the repository root. Development scripts and backups are excluded from the runtime ZIP.

| Command | Purpose |
| --- | --- |
| `bash scripts/install.sh` | Install source runtime files and compile schemas for the next login. |
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
