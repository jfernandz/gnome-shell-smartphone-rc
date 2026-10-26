# Security model

This extension grants pointer and keyboard control of an unlocked GNOME desktop. Use it on a local network you trust. A remembered browser can reconnect while the user has manually enabled the service; desktop lock, disable, and service stop terminate control. Login and lock screens are outside its scope.

## Server identity

LAN access requires HTTPS/WSS. Setup creates a private local key and a self-signed certificate; it does not install a certificate authority or change the firewall. Before approving a new browser, compare the PC's SHA-256 fingerprint with the certificate details provided by the phone browser. The approval dialog requires acknowledgement of that comparison. A fingerprint displayed inside a web page, including one derived from a QR link, is not independent verification of TLS identity.

This remains manual certificate verification, not automatic browser certificate pinning. Repeat the comparison whenever the browser warns about a changed certificate, including for remembered devices. Stop if the fingerprints differ. The desktop independently computes the local fingerprint and checks the service's certificate against it. Local certificate validation explicitly checks not-before/not-after dates and the selected IP subject alternative name; it does not rely solely on verify() flags for self-signed validity. Generation validates staged credentials before committing configuration. Cancellation/timeout waits for the direct child to terminate before partial-file cleanup.

Old unreferenced generated certificate directories older than 24 hours are eligible for cleanup only before service startup, after stopping the previous helper. Selected/recent certificates, staging directories, legacy files, symlinks and directories containing unexpected files are retained. This avoids changing a running helper's credential files; files are not securely erased from storage.

## Pairing and trust

Pairing invitations use 32 random bytes, expire after two minutes, and are consumed by approval. The invitation fragment is kept until approval to support opening Lens links in Chrome. It is sent in the first WSS message, never in the handshake query. New browsers need explicit desktop approval within 30 seconds of connecting. Valid temporary or remembered authorization allows recovery without another approval.

Recovery cookies use Secure, HttpOnly, SameSite=Strict, a host-only `__Host-` name, and Path=/. Temporary authorization expires after 30 minutes of inactivity. Remembering a browser is opt-in, with 7, 30, or 90 days selected in Settings; 90 days remains the default for compatibility. Invalid configured durations fall back to seven days. The duration applies only to new enrollments; existing devices keep their recorded expiry.

The PC stores credential verifiers, not raw remembered credentials. Individual revocation is permanent for that credential; Forget all changes the trust generation. Mutable names and last-use metadata cannot restore revoked authorization. Disconnect preserves remembered trust; Forget revokes it. Cookies identify a browser profile, not physical hardware, and a copied valid credential can impersonate it until expiry or revocation.

## Network and process boundaries

Network parsing and session serving run in a separate GJS child. GNOME Shell communicates through a private peer-to-peer D-Bus connection over a Unix socket in a mode-0700 temporary directory. The controller accepts only the spawned child's UID/PID; the child independently checks the parent's Unix socket credentials. The listener stops accepting after the expected child connects. Typed, acknowledged methods carry bounded values; there is no public session-bus name, broadcast signal or D-Bus activation. Shell validates input again and applies it only after startup and in the connected state. Connection loss, invalid/excessive messages, child crash, lock and disable stop control. There is no automatic restart after a helper failure or unlock.

The child has a 512 MiB data-allocation limit, 128 file descriptors, and disabled core dumps through util-linux prlimit. It shares the user's OS identity; this is process fault isolation, not an OS sandbox or a boundary against malicious software already running as that user. The data limit is not a claim that all kinds of process memory are capped at 512 MiB.

Current application limits:

- 32 simultaneous TCP connections, at most 16 per peer address.
- Five-second TLS/header/request deadlines; bounded closing handshakes and WebSocket ping/pong liveness checks.
- Global and per-peer connection/request budgets, including a burst allowance for browser module loading.
- No HTTP request bodies, transfer-encoded bodies, or query strings; header and URI limits.
- Four unauthenticated WebSockets, with five seconds to send an authentication message of at most 256 bytes.
- 2 KiB per WebSocket frame and complete message, enforced by libsoup 3.8 or later before application parsing.
- D-Bus application payloads up to 4096 serialized bytes, at most 64 queued outgoing calls plus one in flight, 512 incoming application calls per second, and a five-second call deadline. A separate eight-second startup deadline bounds helper setup.
- Bounded validated input, per-connection input rate limits, and an independent Shell-side input limiter.

The D-Bus application-size check runs after GDBus has received/deserialized the native message. It is not a pre-allocation byte cap like the old pipe reader. The private endpoint and UID/PID checks restrict application access to the spawned peer; this is still not a sandbox against compromised same-user code or an exhaustive native D-Bus parser audit. See [DBUS.md](DBUS.md).

Addresses are informational labels, never proof of device identity. Binding to a private address does not replace firewall policy or prevent a separately configured router/VPN from forwarding traffic.

## Validation and remaining work

Regression coverage includes rejected HTTP uploads before 100 Continue, oversized headers, fragmented messages, URL credentials, slow connections, authentication expiry, origin checks, revoked credentials, process crash, and parent disappearance. Chromium checks exercise temporary and remembered sessions through the real helper, including service/browser restart and shorter trust duration. Native checks cover the certificate gate, preferences, and lock/crash cleanup. The user also confirmed the new flow works on the physical phone.

These are bounded checks, not an exhaustive denial-of-service or native-library security audit. Keep GNOME, GJS, GnuTLS and libsoup updated. First-use certificate verification remains a user action; iOS and full accessibility/browser coverage remain unvalidated. Public distribution/review is tracked in [PUBLICATION.md](PUBLICATION.md).

Do not publish private keys, pairing links, cookies, or typed text in bug reports. Use private maintainer reporting for suspected authorization or credential disclosure issues.
