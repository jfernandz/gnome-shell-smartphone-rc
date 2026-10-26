# Static review findings

Reviewed on 2026-10-25 with shexli 0.2.1, Python 3.14, tree-sitter 0.25.2 and tree-sitter-javascript 0.25.0. This records our assessment, not approval by extensions.gnome.org reviewers. Architecture acceptance, particularly the bundled mobile web interface, remains an open publication question.

## Reproduce the analysis

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-review.txt
shexli dist/smartphone-rc-0.4.7.zip
```

The released v0.4.5 ZIP produces seven findings: two errors, four warnings and one manual-review item. On this machine, tree-sitter 0.26.0 causes a native crash during analysis; changing only that dependency to 0.25.2 completed three consecutive runs. The exact underlying native defect has not been established. The pins above reproduce the working toolchain; no dependency is installed into GNOME Shell or shipped in our ZIP.

The v0.4.7 ZIP includes the asynchronous file-I/O changes and produces six findings: two errors, three warnings and one manual-review item. No validator rules were disabled or patched to obtain these results. The original v0.4.5 release artifact remains unchanged.

Build a separate development snapshot without overwriting a release artifact with:

```sh
bash scripts/package.sh dist/review
shexli dist/review/smartphone-rc-0.4.7.zip
```

## Findings and disposition

| Rule | Assessment | Action or evidence |
| --- | --- | --- |
| EGO-X-004 — synchronous Shell file I/O | Valid improvement; addressed in v0.4.6. | Configuration, certificate/key reads, directory enumeration and eligible old-certificate deletion now use cancellable asynchronous GIO operations. Stop and disable invalidate pending startup before it can launch a helper or display a stale setup dialog. |
| EGO-M-004 — GNOME 51 considered a future version | Validator limitation. | shexli 0.2.1 `analyzer/rules/metadata.py` marks every major version above 50 as future. GNOME 51 is released and the physical desktop runs Shell 51.1. Keep the truthful `shell-version: ["51"]`; do not claim support for an older untested release to silence the check. |
| EGO-P-002 — missing fixed browser-schema path | Validator limitation for relocatable schemas. | GSettings deliberately permits a schema without a fixed path. `trusted.js` instantiates it under `/org/gnome/shell/extensions/smartphone-rc/browsers/<verifier>/`. Both the schema ID and actual instance paths use the required namespace. Strict schema compilation and cross-process revocation tests pass. Adding a fixed path would defeat the per-browser instances. |
| EGO-P-007 — JavaScript outside the static import graph | Expected separate entry points; architecture needs reviewer consideration. | `service.js` launches `app/service-worker.js` in another GJS process, which imports server and network guard. The served HTML loads `app/web/app.js`, which imports the mobile client modules. These files are runtime dependencies, declared in resources.json and checked by packaging/browser/helper tests. Importing them into Shell solely to satisfy reachability would be incorrect. |
| EGO-L-002 — menu rows lack individual destroy calls | Ownership false positive, verified natively. | `_status`, `_address` and `_remember` belong to the indicator's menu. `disable()` destroys the indicator; GNOME destroys the menu, whose `removeAll()` destroys its items. The isolated native regression observes destroy on all three rows, including disable during asynchronous startup. |
| EGO-L-003 — notification destroy signal lacks explicit disconnect | Signal lifetime tied to owned notification. | `_clearNotification()` clears actions and destroys the notification during stop/disable. The callback also clears our reference when dismissed externally. GNOME's Notification.destroy() emits destroy and then disposes the GObject, releasing its handlers. This is not a connection left on a long-lived global emitter. Native pairing/lock/crash checks exercise notification cleanup. |
| EGO-A-005 — clipboard access | Expected manual review. | The Copy pairing link action writes the current invitation only after an explicit click. Metadata declares this clipboard use. There is no clipboard read, default copy shortcut, or automatic sharing. Pairing invitations remain secrets and should not be posted publicly. |

## Primary references

- [GNOME release calendar](https://release.gnome.org/calendar/): release 51 and stable branch 51.
- [GSettings relocatable schemas](https://docs.gtk.org/gio/class.Settings.html#relocatable-schemas): schemas without a fixed path and paths supplied per instance.
- [GNOME extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html): lifecycle cleanup, clipboard declarations, scripts and schemas.
- [GNOME Shell 51 popup menu implementation](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/51.1/js/ui/popupMenu.js): menu destroy/removeAll ownership.
- [GNOME Shell 51 notifications](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/51.1/js/ui/messageTray.js): Notification.destroy() emits destroy and disposes the object.

## Validation

The automated protocol, process, certificate, schema and packaging suite and real Chromium helper recovery/revocation suite pass. Native GTK checks cover preferences, network setup and failure recovery. The isolated Shell harness additionally verifies first-approval certificate acknowledgement, helper crash, lock shutdown, Stop during pending asynchronous reads, and menu-row destruction on disable during pending reads. None of these tests locks or restarts the working desktop.

See [TESTING.md](TESTING.md) for the broader validation record and [PUBLICATION.md](PUBLICATION.md) for remaining distribution work. The v0.4.5 release ZIP remains unchanged; these explanations do not mean that every remaining finding will be accepted by a reviewer.

## D-Bus and app layout — development

The unreleased D-Bus migration groups the worker/server/guard and web assets under app/, with typed private peer methods in shared dbus.js. It removes ipc.js and does not add a public bus service. These are still separate entry points, so EGO-P-007 remains expected; grouping them supports reviewer inspection rather than suppressing the rule. See [DBUS.md](DBUS.md) and the maintainer feedback in PUBLICATION.md.
