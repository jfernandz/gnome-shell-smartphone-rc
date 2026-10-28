# Proposed features

These are unimplemented proposals. Current features and releases are documented in [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md).

- **Focused-field text synchronization:** investigate reading existing text and the cursor/selection from the focused desktop field and showing them in the phone editor, allowing edits to existing content. Evaluate GNOME input-method surrounding text and accessibility APIs; determine application support and whether exposed text is complete or partial. Make content sharing explicit and opt-in, exclude password and sensitive fields, and avoid logging or persisting field contents. Define how desktop edits, focus changes, IME composition and stale updates are reconciled before applying remote changes. Assess whether reliable state synchronization could improve edit acknowledgements and prevent unnecessary typing pauses; retain the current input path when reading is unavailable.

All new remote actions must preserve the authorization, validation and lifecycle boundaries in [SECURITY.md](SECURITY.md).

## Documentation

- **Migrate documentation to AsciiDoc:** evaluate moving the Markdown documentation to `.adoc`, using admonitions (NOTE, TIP, IMPORTANT, WARNING and CAUTION), cross-references, reusable attributes, includes, tables and source-code blocks where useful. Preserve links and navigation, check GitHub rendering and contributor tooling, and define which documents to migrate before changing formats.
