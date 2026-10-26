# Project scope

Provide smartphone-browser pointer and keyboard control of an unlocked GNOME desktop over the local network, without a mobile app. Target GNOME Shell 51 on Wayland; one browser controls the desktop at a time. The PC may use Ethernet.

Screen streaming, internet relays, file transfer, login/lock-screen control and remote wake-up are outside the current scope. Automatic service startup and restart after unlock remain proposals.

## Implemented

- HTTPS/WSS, expiring QR invitations, desktop approval and manual certificate verification.
- Touchpad/clicks/scroll, live typing, IME composition handling and desktop focus detection.
- Settings-based network/certificate setup, sensitivity limits and remembered-browser management.
- Bounded network child, authenticated private D-Bus and stop-on-lock/disable/failure.
- Separate source-reload and packaged-ZIP workflows, including rollback and private archive snapshots.

Release details are in [CHANGELOG.md](CHANGELOG.md); implemented features are not a claim of complete compatibility or publication approval.

## Remaining work

- Expand application/IME, iOS, multi-monitor/scaling and long-session/network-interruption coverage.
- Complete real assistive-technology and first-use certificate-warning checks.
- Assess sustained resource exhaustion and additional OS isolation.
- Confirm the final v0.5.1 ZIP on the physical setup; isolated Shell checks pass with the corrected development installer.
- Prepare screenshots/device records and complete maintainer review and distribution readiness.

See [TESTING.md](TESTING.md) for evidence, [IDEAS.md](IDEAS.md) for proposals, [PUBLICATION.md](PUBLICATION.md) for distribution, and [CONTRIBUTING.md](CONTRIBUTING.md) for the working agreement. Publication requires a separate request; the source repository URL is already configured.
