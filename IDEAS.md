# Proposed features

These are unimplemented proposals. Current features and releases are documented in [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md).

- **Desktop lock:** an explicit action that immediately disconnects and stops the service. Unlocking and service reactivation remain local; queued input must not survive lock.
- **Suspend:** confirm before sleeping, respect system availability/inhibitors/authorization, lock first and stop control. Require local reactivation after resume; remote wake-up needs a separate design.
- **Optional startup after login:** disabled by default, relying on remembered-browser trust. Keep stop/revocation available and require approval for new browsers. Restart after unlock needs its own opt-in setting; neither option permits login/lock-screen control.
- **Automatic service shutdown timer:** optionally stop remote control after a configurable duration. Define whether the timer measures total running time or inactivity, show the remaining time, and allow cancellation or extension locally. Expiry should follow the existing Stop cleanup path, disconnect browsers and revoke temporary sessions without automatically restarting the service.
- **Landscape mobile layout:** explore moving controls below the touchpad in landscape orientation so the touch surface gets as much space as possible. Evaluate a compact or collapsible controls area, keeping connection, keyboard, sensitivity, volume and click actions accessible. Check orientation changes, short viewports, browser safe areas, enlarged text and the mobile keyboard without losing touch gestures or keyboard focus.
- **Focused-field text synchronization:** investigate reading existing text and the cursor/selection from the focused desktop field and showing them in the phone editor, allowing edits to existing content. Evaluate GNOME input-method surrounding text and accessibility APIs; determine application support and whether exposed text is complete or partial. Make content sharing explicit and opt-in, exclude password and sensitive fields, and avoid logging or persisting field contents. Define how desktop edits, focus changes, IME composition and stale updates are reconciled before applying remote changes. Assess whether reliable state synchronization could improve edit acknowledgements and prevent unnecessary typing pauses; retain the current input path when reading is unavailable.

All new remote actions must preserve the authorization, validation and lifecycle boundaries in [SECURITY.md](SECURITY.md).

## Documentation

- **Migrate documentation to AsciiDoc:** evaluate moving the Markdown documentation to `.adoc`, using admonitions (NOTE, TIP, IMPORTANT, WARNING and CAUTION), cross-references, reusable attributes, includes, tables and source-code blocks where useful. Preserve links and navigation, check GitHub rendering and contributor tooling, and define which documents to migrate before changing formats.
