# Security model

This extension grants pointer, keyboard and default audio-output control of an unlocked GNOME desktop. Use a trusted local network. A remembered browser can reconnect while the service is running; lock, disable and Stop terminate control. Login/lock-screen access and automatic startup are unsupported.

## Server identity and credentials

LAN access requires HTTPS/WSS. Setup creates a private key and self-signed certificate without installing a CA or changing firewall rules. Before first approval, compare the PC's SHA-256 fingerprint with the phone browser's **certificate details**; the native approval dialog requires acknowledgement. A fingerprint shown inside the web page or QR is not independent verification. This is manual verification, not browser certificate pinning. Repeat it for changed certificates, including remembered browsers; stop on a mismatch.

The PC validates certificate dates and the selected IP subject alternative name, computes the fingerprint independently, and cross-checks the helper's certificate. Generation validates staged credentials before committing configuration. Cancellation/timeout reaps the direct child before partial-file cleanup.

Before startup, after stopping the previous helper, unreferenced generated certificate directories older than 24 hours are eligible for cleanup. Selected/recent credentials, staging directories, legacy files, symlinks and directories with unexpected files are retained. Deletion is not secure erasure. Development snapshots have a separate [manual cleanup policy](scripts/README.md#cache-cleanup).

## Pairing and trust

- Invitations use 32 OS-random bytes, expire after two minutes and are consumed by approval. The secret remains in the URL fragment/tab session storage until approval so pending Lens links can open in Chrome. It travels in the first WSS message, never the handshake query. A mode-0600 PC runtime file holding the link is removed on approval, expiry or stop.
- New browsers require desktop approval within 30 seconds of connecting. Valid temporary or remembered credentials allow recovery without fresh approval.
- Recovery cookies are host-only `__Host-` cookies with Secure, HttpOnly, SameSite=Strict and Path=/. Secrets are not exposed to JavaScript. Temporary authorization expires after 30 minutes of inactivity and is revoked on Disconnect, service restart/stop, lock or disable. Periodic cookie refresh does not extend that server-side deadline; input and foreground resume do.
- Remembering is opt-in for 7/30/90 days (default 90; invalid configured values fall back to seven). The duration applies only to new enrollments and does not renew on use. Trust survives service/login restarts.
- The PC stores SHA-256 verifiers and display metadata, not raw remembered credentials. Individual revocation is permanent for that credential; Forget all changes the trust generation. Stale enrollment snapshots or metadata updates cannot restore revoked trust.
- Disconnect preserves remembered trust; Forget revokes it immediately. Cookies identify a browser profile, not hardware. A copied valid credential can impersonate it until expiry/revocation. IP addresses and device names are labels, not proof of identity.

## Network and process boundaries

The separate GJS network child communicates with Shell over authenticated private Unix peer D-Bus. Both sides check UID/PID, the listener stops accepting after the child connects, and Shell independently validates startup and input. No public session-bus name, activation or broadcast signal is used. See [DBUS.md](DBUS.md) for the contract and application limits.

Malformed/excessive messages, connection loss, helper failure, lock and disable stop control. There is no automatic restart. The child runs as the same user with a 512 MiB data-allocation limit, 128 file descriptors and disabled core dumps via `prlimit`. This provides fault isolation, not an OS sandbox or a cap on every kind of memory allocation.

Network limits include:

- 32 simultaneous TCP connections, at most 16 per address, plus global/per-peer connection and request budgets.
- Five-second TLS/header/request deadlines, bounded closing handshakes and WebSocket liveness checks.
- Configured Host/Origin checks; no request bodies, transfer encoding or query strings; bounded headers/URIs.
- Four unauthenticated WebSockets, five seconds to authenticate, and a 256-byte authentication-message limit.
- 2 KiB per WebSocket frame and complete message, enforced by libsoup 3.8+ before application parsing; validated/rate-limited input and an independent Shell limiter.

D-Bus application-size checks occur **after** native GDBus reception/deserialization. They are not pre-allocation byte caps. UID/PID checks restrict the private endpoint but do not sandbox compromised same-user code or prove native-parser denial-of-service resilience. Binding a private address also does not prevent separately configured router/VPN forwarding or replace firewall policy.

## Remote audio

Volume and mute commands use the same approved, foreground session and
independent network/Shell validation as pointer input. Volume percentages
are integers from 0 to 100; commands identify the intended default output.
The Shell ignores stale output IDs and removes mixer listeners and pending
state timers when the session leaves the connected state. Unmuting a locally
amplified output first caps it at 100%. No microphone control or audio
capture/streaming is provided.

## Evidence and reporting

[TESTING.md](TESTING.md) distinguishes current automated checks, earlier browser/native runs and physical acceptance. These are bounded regressions, not an exhaustive security audit. Sustained resource exhaustion, broader browser/IME support and real assistive-technology coverage remain open. First-use certificate verification remains a user action.

Keep GNOME, GJS, GnuTLS and libsoup updated. Never post private keys, pairing links, cookies or typed text in bug reports. Report suspected authorization or credential disclosure privately to the maintainer. [PUBLICATION.md](PUBLICATION.md) tracks distribution readiness.
