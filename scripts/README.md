# Project scripts

Run these commands from the project directory. No scripts are shipped in the extension ZIP.

| Entry point | Purpose | Used by |
| --- | --- | --- |
| `bash scripts/setup-network.sh [address]` | Configure the LAN address and local TLS certificate. | Initial setup or network/certificate changes. |
| `bash scripts/install.sh` | Install runtime files and compile settings schemas. | Local installation for the next login. |
| `bash scripts/package.sh [output-directory]` | Build an extension ZIP from the runtime manifest. | Release packaging and package-content tests. |
| `bash scripts/prepare-reload.sh` | Print the reusable Looking Glass reload command. | Development without logging out. |
| `scripts/reload.js` | Build and load fresh source when imported from Looking Glass. | The existing Looking Glass command/history. |

`prepare-reload.sh --build-only` is an internal interface used by `reload.js`: it stages a fresh snapshot and prints its path. Both paths remain stable so a reload module already cached by GNOME Shell keeps working.

Helpers under `lib/` are implementation details:

- `stage.sh`: copy only declared runtime files and compile schemas; shared by installation, packaging, reload, and integration tests.
- `runtime-files.js`: read and validate the runtime manifest; used by staging and packaging.
- `check-address.js`: reuse the application's IPv4 validation before network setup writes configuration or invokes OpenSSL.

Phone pairing uses the QR code or the menu's Copy pairing link action. The old ADB page-opening helper has been removed.
