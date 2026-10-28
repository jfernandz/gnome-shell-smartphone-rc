# Smartphone Remote Control v0.5.2

Historical record for the stated version/date. For current instructions and
readiness, see [README](../README.md), [TESTING](../TESTING.md) and
[PUBLICATION](../PUBLICATION.md).

Prepared locally; not published or submitted.

- Prevent delayed session responses from changing a newer browser connection or reviving recovery after Disconnect. Cancel obsolete requests and disable input immediately on Disconnect.
- Handle malformed WebSocket messages and preserve Shell focus, keyboard and approval resources when a state repeats.
- Separate temporary helper authorization from transport, keep independent Shell startup validation, and name transport limits by meaning and unit.
- Include the previously verified development-installer corrections and isolated native test launcher.

Validation: ESLint and all 85 automated tests pass. Chromium temporary/remembered authorization and accessibility checks passed on the same runtime before the version bump. The final v0.5.2 ZIP passes the isolated Shell installation/lifecycle/preferences harness, and all 39 packaged files match runtime source byte-for-byte. GTK teardown emits focus-out warnings; assertions pass. Physical-phone acceptance of this ZIP remains pending.

Artifact: `dist/v0.5.2-verification/smartphone-rc-0.5.2.zip`

SHA-256: `28c039f11cd842cd2dadceb6ae70e402cd3d6912b5ac1b1ffe075259ba58446a`

No working GNOME session was modified. The release is committed and tagged locally as v0.5.2; no push, release publication or extensions.gnome.org submission was performed.
