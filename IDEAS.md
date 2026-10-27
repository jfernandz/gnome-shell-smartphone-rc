# Proposed features

These are unimplemented proposals. Current features and releases are documented in [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md).

- **Desktop lock:** an explicit action that immediately disconnects and stops the service. Unlocking and service reactivation remain local; queued input must not survive lock.
- **Suspend:** confirm before sleeping, respect system availability/inhibitors/authorization, lock first and stop control. Require local reactivation after resume; remote wake-up needs a separate design.
- **Optional startup after login:** disabled by default, relying on remembered-browser trust. Keep stop/revocation available and require approval for new browsers. Restart after unlock needs its own opt-in setting; neither option permits login/lock-screen control.
- **Focused-field text synchronization:** investigate reading existing text and the cursor/selection from the focused desktop field and showing them in the phone editor, allowing edits to existing content. Evaluate GNOME input-method surrounding text and accessibility APIs; determine application support and whether exposed text is complete or partial. Make content sharing explicit and opt-in, exclude password and sensitive fields, and avoid logging or persisting field contents. Define how desktop edits, focus changes, IME composition and stale updates are reconciled before applying remote changes. Assess whether reliable state synchronization could improve edit acknowledgements and prevent unnecessary typing pauses; retain the current input path when reading is unavailable.

All new remote actions must preserve the authorization, validation and lifecycle boundaries in [SECURITY.md](SECURITY.md).
