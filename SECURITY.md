# Security model

This extension grants pointer and keyboard control of an unlocked GNOME desktop. Use it on a local network you trust. A remembered browser can reconnect while the user has manually enabled the service; desktop lock, disable, and service stop terminate control. Login and lock screens are outside its scope.

## Server identity

Wi-Fi requires HTTPS/WSS. Setup creates a private local key and a self-signed certificate; it does not install a certificate authority or change the firewall. Before approving a new browser, compare the PC's SHA-256 fingerprint with the certificate details provided by the phone browser. The approval dialog requires acknowledgement of that comparison. A fingerprint displayed inside a web page, including one derived from a QR link, is not independent verification of TLS identity.

This remains manual certificate verification, not automatic browser certificate pinning. Repeat the comparison whenever the browser warns about a changed certificate, including for remembered devices. Stop if the fingerprints differ. The desktop independently computes the local fingerprint and checks the service's certificate against it.

## Pairing and trust

Pairing invitations use 32 random bytes, expire after two minutes, and are consumed by approval. The invitation fragment is kept until approval to support opening Lens links in Chrome. It is sent in the first WSS message, never in the handshake query. New connections need explicit desktop approval within the pending window.

Recovery cookies use Secure, HttpOnly, SameSite=Strict, a host-only `__Host-` name, and Path=/. Temporary authorization expires after 30 minutes of inactivity. Remembering a browser is opt-in, with 7, 30, or 90 days selected in Settings; 90 days remains the default for compatibility. Invalid configured durations fall back to seven days. The duration applies only to new enrollments; existing devices keep their recorded expiry.

The PC stores credential verifiers, not raw remembered credentials. Individual revocation is permanent for that credential; Forget all changes the trust generation. Mutable names and last-use metadata cannot restore revoked authorization. Disconnect preserves remembered trust; Forget revokes it. Cookies identify a browser profile, not physical hardware, and a copied valid credential can impersonate it until expiry or revocation.

## Network and process boundaries

Network parsing and session serving run in a separate GJS child. GNOME Shell communicates through inherited private pipes, accepts bounded JSON envelopes, validates input again, and applies input only in the connected state. EOF, protocol failure, child crash, lock, and disable stop control. There is no automatic restart after a helper failure or unlock.

The child has a 512 MiB data-allocation limit, 128 file descriptors, and disabled core dumps through util-linux prlimit. It shares the user's OS identity; this is process fault isolation, not an OS sandbox or a boundary against malicious software already running as that user. The data limit is not a claim that all kinds of process memory are capped at 512 MiB.

Current application limits:

- 32 simultaneous TCP connections, at most 16 per peer address.
- Five-second TLS/header/request deadlines; bounded closing handshakes and WebSocket ping/pong liveness checks.
- Global and per-peer connection/request budgets, including a burst allowance for browser module loading.
- No HTTP request bodies, transfer-encoded bodies, or query strings; header and URI limits.
- Four unauthenticated WebSockets, with five seconds to send an authentication message of at most 256 bytes.
- 2 KiB per WebSocket frame and complete message, enforced by libsoup 3.8 or later before application parsing.
- Bounded validated input, per-connection input rate limits, bounded private-pipe queues/messages, and an independent Shell-side input limiter.

Addresses are informational labels, never proof of device identity. Binding to a private address does not replace firewall policy or prevent a separately configured router/VPN from forwarding traffic.

## Validation and remaining work

Regression coverage includes rejected HTTP uploads before 100 Continue, oversized headers, fragmented messages, URL credentials, slow connections, authentication expiry, origin checks, revoked credentials, process crash, and parent disappearance. Chromium checks exercise temporary and remembered sessions through the real helper, including service/browser restart and shorter trust duration. Native checks cover the certificate gate, preferences, and lock/crash cleanup. The user also confirmed the new flow works on the physical phone.

These are bounded checks, not an exhaustive denial-of-service or native-library security audit. Keep GNOME, GJS, GnuTLS and libsoup updated. First-use certificate verification remains a user action; iOS and full accessibility/browser coverage remain unvalidated. Public distribution/review is tracked in PUBLICATION.md.

Do not publish private keys, pairing links, cookies, or typed text in bug reports. Use private maintainer reporting for suspected authorization or credential disclosure issues.
