# Accessibility validation

Current browser evidence: v0.6.3 on 2026-10-28. These are focused Chromium regressions, not WCAG certification or real screen-reader acceptance. Earlier native light/dark/enlarged-font checks are recorded in [TESTING.md](TESTING.md) and its history.

## Mobile interface

- The floating **•••** button has the accessible name Controls. Its native popover exposes connection, keyboard, sensitivity, sound and confirmed Lock PC/Suspend PC controls directly; Escape/light dismissal closes it. Focus inside a closing card returns to its trigger.
- Keyboard reports editor visibility through aria-expanded/aria-controls. Opening it closes the card and focuses the editor. The editor remains outside the card; controls remain available while typing.
- Sensitivity/volume sliders have labels; sensitivity exposes its multiplier through aria-valuetext. Mute/Unmute exposes a pressed state. Duplicate visual outputs are hidden from the accessibility tree.
- Connection status uses role=status. Editor and touchpad reference their instructions. Focus outlines are explicit; buttons and sliders have minimum 44-pixel targets.
- The touchpad supports tap, hold and two-finger gestures. There are no separate click buttons or keyboard shortcuts for pointer movement/scrolling.
- The page uses a dark scheme; native Settings follows GNOME's theme.

```sh
npm run test:accessibility
# Save synthetic page captures:
SMARTPHONE_RC_ACCESSIBILITY_OUTPUT=dist/accessibility npm run test:accessibility
```

The suite checks the card without scrolling at 360×800, 320×568, 568×320, 844×390, 568×240 and 844×180, plus 200% root text at 568×320 and 320×568. It measures after the opening animation and checks target bounds/heights, slider/button accessible names, Escape dismissal/focus return and editor text/selection/focus across rotation and short keyboard viewports.

The lock/suspend buttons have accessible names and stay disabled unless connected. Native browser confirmation is used; cancellation preserves the connection. Confirmation tests stub only the dialog result and never call host power APIs.

Contrast assertions sample the enabled Controls button and touchpad instructions at 4.5:1 or greater. They do not audit every state or color. Enlarged root text and simulated viewports do not establish browser zoom, physical scaling or real software-keyboard behavior.

## Native preferences

The isolated GTK harness checks accessible names for per-browser Rename/Forget, the Device name entry, sensitivity and About. Automatic stop uses labelled native switch/spin rows; checks cover the disabled default, duration updates and external settings synchronization. Run through the [isolated launcher](TESTING.md#native-checks), not the working desktop.

| Environment variable | Purpose |
| --- | --- |
| SMARTPHONE_RC_TEST_COLOR_SCHEME=light/dark | Process-local theme. |
| SMARTPHONE_RC_TEST_FONT="Sans 11"/"Sans 22" | Normal/enlarged test font. |
| SMARTPHONE_RC_TEST_SCREENSHOT=/absolute/path.png | Rendered preference-window capture. |

These fixtures use separate configuration and memory GSettings. Generated images stay under dist/ and are not shipped in the extension ZIP.

## Remaining manual checks

- TalkBack/Orca announcements, reading order, focus and activation during connection/editor transitions.
- Touch target comfort, real keyboards, orientation and enlarged-text occlusion.
- Browser pinch zoom, desktop fractional/high-DPI scaling and forced colors/high contrast.
- Complete contrast/state audit and iOS/other browser support.

Publication readiness is tracked in [PUBLICATION.md](PUBLICATION.md).
