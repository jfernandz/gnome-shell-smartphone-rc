# Accessibility validation

Validated for v0.4.7 on 2026-10-25. This is a focused validation record, not a claim of complete WCAG compliance or screen-reader certification. Target mobile support remains Chrome on Android. Checks use a synthetic local browser session and isolated native preferences, never the working desktop's remote connection.

## Mobile interface

- Native buttons, a labelled sensitivity range and a labelled text input retain standard keyboard behavior.
- Connection status uses role=status. Keyboard exposes aria-controls and an aria-expanded state synchronized with editor visibility. Hiding an editor that owns focus returns focus to Keyboard when that control is enabled.
- The sensitivity range exposes its multiplier through aria-valuetext; the duplicate visual output is hidden from the accessibility tree.
- The editor and touchpad reference their explanatory text. The touchpad remains a touch-gesture surface; there are no keyboard shortcuts for pointer movement or two-finger scrolling.
- Keyboard focus has an explicit visible outline. Buttons and the sensitivity range have a minimum 44-pixel target height.
- Connection buttons wrap instead of overflowing narrow layouts. Touchpad height accommodates its instructions when text grows; vertical scrolling is allowed when space is limited.
- The mobile page deliberately uses a dark color scheme. Native Settings follows GNOME's theme.

Run the real Chromium checks with:

```sh
npm run test:accessibility
```

This also runs the existing trusted-browser/helper recovery suite. The accessibility checks cover 360×800 and 320×568 portrait, 568×320 landscape, and a 320×568 layout with the root font increased from 16 to 32 pixels. The last case simulates 200% text size; it does not establish physical display scaling or browser pinch-zoom behavior.

Assertions cover horizontal overflow, target height, touchpad instruction containment, forward/reverse Tab order, focus outline, Enter activation, editor focus/return, accessibility-tree names and disclosure state. Enabled button, status and touchpad-help text are checked for at least 4.5:1 contrast; this samples key text rather than auditing every rendered color or state.

To save synthetic mobile screenshots for visual inspection:

```sh
SMARTPHONE_RC_ACCESSIBILITY_OUTPUT=dist/accessibility npm run test:accessibility
```

## Native preferences

Remembered-browser Rename and Forget actions have explicit accessible names identifying the browser. The rename entry is labelled Device name. The native preferences harness uses GTK's test accessibility backend and checks that these labels are set, alongside the existing rename, revocation, sensitivity and About assertions.

Run native tests only in an isolated graphical compositor with a separate D-Bus session. Use GSETTINGS_BACKEND=memory and a temporary XDG_CONFIG_HOME, passing a staged extension directory with compiled schemas to tests/preferences-native.mjs. Optional environment variables:

- SMARTPHONE_RC_TEST_COLOR_SCHEME=light or dark forces the process's theme for the test.
- SMARTPHONE_RC_TEST_FONT="Sans 11" or "Sans 22" selects the process's font, covering normal/enlarged text in the recorded runs.
- SMARTPHONE_RC_TEST_SCREENSHOT=/absolute/path/preview.png saves a rendered test window for inspection.

These settings are process-local. They do not change the user's theme, font, remembered browsers or network setup. Browser and native preview images are generated artifacts under dist and are not shipped in the extension ZIP.

## Remaining manual checks

- Real TalkBack/Orca announcements, reading order and activation, including connection and typing transitions.
- Physical touchscreen target comfort and keyboard occlusion with enlarged text and different mobile keyboards.
- Browser pinch zoom and real desktop fractional/high-DPI scaling.
- Forced-colors/high-contrast themes, all focus/error/disabled states and a complete contrast audit.
- iOS Safari and other browsers; current Chromium checks do not imply cross-browser support.

See [TESTING.md](TESTING.md) for other validation and [PUBLICATION.md](PUBLICATION.md) for remaining distribution work.
