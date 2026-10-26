# Project scripts

Run these commands from the project directory. No scripts are shipped in the extension ZIP.

| Entry point | Purpose | Used by |
| --- | --- | --- |
| `bash scripts/install.sh` | Install runtime files and compile settings schemas. | Local installation for the next login. |
| `bash scripts/package.sh [output-directory]` | Build an extension ZIP from the runtime manifest. | Release packaging and package-content tests. |
| `bash scripts/prepare-reload.sh` | Print the reusable Looking Glass reload command. | Development without logging out. |
| `bash scripts/prepare-zip-install.sh [zip-path]` | Select a ZIP and print a stable Looking Glass install command. | Defaults to the newest modified ZIP under dist/, including review/. |
| `scripts/install-zip.js` | Install a selected ZIP with gnome-extensions and load the installed files through a fresh import alias. | Packaged-build testing from Looking Glass. |
| `scripts/reload.js` | Build and load fresh source when imported from Looking Glass. | The existing Looking Glass command/history. |

`prepare-reload.sh --build-only` is an internal interface used by `reload.js`: it stages a fresh snapshot and prints its path. Both paths remain stable so a reload module already cached by GNOME Shell keeps working.

Helpers under `lib/` are implementation details:

- `stage.sh`: copy only declared runtime files and compile schemas; shared by installation, packaging, reload, and integration tests.
- `runtime-files.js`: read and validate the runtime manifest; used by staging and packaging.

Phone pairing uses the QR code or the menu's Copy pairing link action. The old ADB page-opening helper has been removed.

## Install and reload a ZIP

Generate the command from the project directory:

```sh
bash scripts/prepare-zip-install.sh
# Or explicitly select a particular ZIP:
bash scripts/prepare-zip-install.sh /path/to/new-extension.zip
```

The helper selects the most recently modified ZIP under dist/ (including review/) unless a path is supplied, verifies its UUID, and prints its path/version plus a Looking Glass command. It does not build or install a ZIP. Node.js and unzip are used only by this development helper.

Paste the printed command into Looking Glass once. For every subsequent package, rerun the helper and recall the SAME Looking Glass command with Up and Enter. The helper updates a private selection record in the user cache, so the command needs no filename/version edits. The generated tool URI is a stable symlink to install-zip.js; it is not a runtime source build.

Direct explicit-path calls remain available:

```js
await (await import("file:///absolute/path/to/project/scripts/install-zip.js")).installZip("/absolute/path/to/new-extension.zip")
```

This invokes gnome-extensions install --force --print-uuid, installs into the normal per-user extension directory, and reloads only Smartphone Remote Control. It never calls prepare-reload.sh, the source builder, or stage.sh. It checks the ZIP UUID and entry point before unloading the active extension. Existing settings, certificates and remembered devices remain outside the replaced directory.

GJS caches imported module URLs. To load updated dependencies without logging out, the tool creates a fresh symlink import alias pointing at the installed directory. No runtime code is copied from the project or from the ZIP into a separate development build. The loaded files and the normal installed files are the same filesystem objects. GNOME may show the alias as the active path; the normal installation remains in place and is what it discovers at the next login.

This GNOME 51 development tool also clears only this UUID's cached numeric-version reload guard. It does not clear the module cache globally or target other UUIDs. Neither the tool nor its backups is included in the runtime ZIP. Backups and aliases are kept under the user cache in smartphone-rc/zip-install-*; keep the active alias while the session is using it. If installation or loading fails, the tool restores the previous installed directory and reloads it when a prior copy was active. A failed copy is retained in the transaction for diagnosis.

Close Settings before updating and reopen it afterwards. Reloading stops the current remote service/connection; start it manually again from the menu. This is distinct from scripts/reload.js, which builds and loads project source.

The installer first copies the selected archive into a mode-0700 transaction directory (the copy is mode 0600). UUID validation, entry-point validation and official installation all use that copy, so replacing the original path during validation cannot change the installed payload. Avoid editing the archive in place while the initial copy is being made. The private ZIP is removed when the operation finishes; backups, failed installations and import aliases remain available.

Each external command has a 30-second timeout. Commands use the shared GIO subprocess helper, which terminates and reaps the direct child on cancellation or timeout. Explicit callers can pass `installZip(path, {cancellable})` with a `Gio.Cancellable`. Rollback commands have their own timeouts and ignore the cancelled token so restoration can finish. Successful installation enables the new copy; a failed attempt restores this UUID's previous enabled/disabled settings, including a failed first installation. Other extensions' settings are preserved. A rollback failure reports the backup location for manual recovery.

No automatic pruning of reload snapshots or ZIP transaction directories is performed: Shell may lazily import modules through older aliases, and a separate preferences process may still use older files. There is no reliable reference inventory across those processes. For safe manual cleanup, close preferences and end the GNOME session, then remove obsolete `smartphone-rc/zip-install-*` transactions and source reload snapshots under the user cache from another session. Keep any backup needed for recovery, and never remove the normal installed extension directory. Age alone, the current active alias, or closing Looking Glass does not establish that a directory is unused. Empty or validation-only transactions may also remain; their private ZIP copies are removed automatically.
