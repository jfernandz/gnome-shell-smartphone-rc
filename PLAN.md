# Project scope

Provide smartphone-browser pointer, keyboard and default-output audio control of an unlocked GNOME desktop over the local network. Target GNOME Shell 51/Wayland and Chrome on Android; one browser controls the PC at a time. Ethernet on the PC is supported.

Screen/audio streaming, internet relays, file transfer, login/lock-screen control and remote wake-up are outside the current scope. Optional automatic startup and restart after unlock are implemented; new pairing requires a local action by default, with an optional startup window.

Current features: [README](README.md). Version history: [CHANGELOG](CHANGELOG.md).

## Remaining work

- Validate the final package on real devices: certificate first use, typing, volume/output switching and lifecycle cleanup.
- Expand application/IME, iOS, multi-monitor/scaling, long-session and network-interruption coverage.
- Complete real assistive-technology, high-contrast and mobile-keyboard checks.
- Assess sustained resource exhaustion and additional OS isolation.
- Verify the consolidated release workflow on GitHub, select final listing assets and complete maintainer/package review.

[Testing evidence](TESTING.md) · [Feature proposals](IDEAS.md) · [Publication](PUBLICATION.md) · [Contributing](CONTRIBUTING.md)
