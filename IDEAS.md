# Proposed features

These are unimplemented proposals. Current features and releases are documented in [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md).

- **Volume control:** mobile volume/mute for GNOME's default output, reflecting local changes and output switches. Validate authenticated commands, handle missing outputs, and limit volume to 0–100% by default.
- **Desktop lock:** an explicit action that immediately disconnects and stops the service. Unlocking and service reactivation remain local; queued input must not survive lock.
- **Suspend:** confirm before sleeping, respect system availability/inhibitors/authorization, lock first and stop control. Require local reactivation after resume; remote wake-up needs a separate design.
- **Optional startup after login:** disabled by default, relying on remembered-browser trust. Keep stop/revocation available and require approval for new browsers. Restart after unlock needs its own opt-in setting; neither option permits login/lock-screen control.

All new remote actions must preserve the authorization, validation and lifecycle boundaries in [SECURITY.md](SECURITY.md).
