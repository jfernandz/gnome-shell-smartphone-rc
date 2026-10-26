# Publication review — 2026-10-26

Status: technical checks completed locally; nothing submitted. GNOME Shell 51.1, GJS 1.90.1, Chromium 156.0.8078.47. The desktop session was not modified. Tests used disposable browser profiles and a separate headless Shell/bus/XDG profile.

## Artifact and findings

`dist/smartphone-rc-0.5.1.zip` contains exactly the 37 manifest files, byte-identical to current runtime source. No development scripts, tests, credentials or npm dependencies are shipped. SHA-256:

```text
8e1a93a7020848a5f129bc6fa9918ff4a13ed7da91dd37aefd5a2f5dfdba78d1
```

Native testing found two development-installer problems after the v0.5.1 tag:

- `GLib.mkdtemp()` is unavailable in GJS. Use bounded/cancellable `mktemp -d` instead.
- Shell updates enablement asynchronously. Read the previous configuration from GSettings and settle pending enablement changes before loading a restored disabled copy.

These fixes and tests are post-tag source changes, outside the runtime ZIP. Native installer results below use the corrected helper; they do not validate the tagged helper. The tag and ZIP are unchanged.

## Results

| Check | Result |
| --- | --- |
| ESLint and automated suite | Pass; 75 tests. |
| Temporary Chromium recovery | Pass: fresh tab, browser restart, invitation reuse with valid cookie, explicit-disconnect revocation. |
| Trusted Chromium/helper | Pass: service/browser restart, same-page reconnect, cross-browser isolation, individual/global revocation; seven-day policy also passes. |
| Browser accessibility | Pass: names, focus/disclosure, keyboard operation, selected text contrast, narrow/landscape/enlarged-text layouts. |
| Native ZIP | Pass: failed first install, active/disabled rollback, compiled schemas, numeric versions, original-archive replacement during real validation, stable selector command, final project ZIP active. |
| Native Shell lifecycle | Pass: certificate acknowledgement gate, child crash, lock cleanup, no automatic restart, pending-startup cancellation, menu-row destruction. |
| Native preferences | Pass: light/Sans 11, dark/Sans 11 and dark/Sans 22, About, sensitivity, trust management, network setup and dependency-error recovery. GTK emits a focus-out warning in network windows; assertions pass. |
| shexli 0.2.1 | Same six findings: two errors, three warnings and one manual item; disposition in [SHEXLI.md](../SHEXLI.md). No rules suppressed. |

### Bounded load test

`SMARTPHONE_RC_SOAK_SECONDS=120 node tests/network-soak.mjs` ran against the real TLS helper. It opened 1,560 incomplete TLS connections and issued 624 HTTPS requests; 282 returned HTTP 200 during saturation. This is a rejection/recovery check, not uninterrupted availability under attack.

Peak RSS was 58,456 KiB; final growth was 2,772 KiB. Descriptors peaked at 43 and returned to the baseline of 11 after a 16-second recovery window. The service responded normally afterwards, with no helper failure or input dispatch. A two-minute single-peer loopback run does not establish long-term leak freedom, multi-peer resilience or native-parser safety.

## Review and isolation assessment

The review checked import/process boundaries, explicit clipboard use, Shell cleanup paths, typed/validated input, peer identity, temporary/trusted cookie handling, credential publication and archive contents. Native checks confirm ownership cleanup behind the lifecycle analyzer warnings. This is a focused review, not an independent security audit or maintainer sign-off.

The helper still has the user's filesystem/network authority. `prlimit` is resource control, not a sandbox. Filesystem/process isolation through a separate app, bubblewrap or a hardened user service needs a distinct design: retain certificate/runtime access, trust/revocation storage, parent-death handling and D-Bus UID/PID verification. A wrapper can change the actual peer PID, so adding one without revisiting identity checks is unsafe. No sandbox/dependency change was made in this review.

Current [GNOME guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#scripts-and-binaries) still leave bundled HTML/web JavaScript reviewability unresolved. The standalone worker already has the recommended GJS header. Developer loaders that use Shell internals are excluded from the submitted ZIP. A reviewer decision is still needed; [the follow-up draft](reviewer-message-draft.md) has not been sent.

## Maintainer walkthrough

Follow one request through these boundaries before signing off:

1. `extension.js::_start()` reads/validates local configuration, then `service.js` spawns the bounded child and authenticates its private D-Bus peer. Startup failure leaves control off.
2. `app/server.js` validates network requests and manages invitations/cookies. A new request reaches `extension.js::_approveRequest()`, whose native certificate gate must complete before approval.
3. `dbus.js` bounds/acknowledges calls; `service.js` validates input again. `extension.js::_handleInput()` checks typing focus context before `input.js` injects events.
4. `trusted.js` separates irreversible revocation from editable metadata. Disconnect preserves trust; Forget revokes it. No existing desktop text is sent to the phone.
5. `extension.js::_stop()/disable()` clear UI/input/focus and stop the helper. Native lifecycle tests exercise lock, crash and cancellation; they do not prove every application/IME combination.

## Handoff

- Maintainer: review the post-tag development-tool/test changes and choose the release/publication channel. Use the corrected source tools rather than those at the v0.5.1 tag; the runtime artifact is unchanged.
- Record phone/browser versions and results. Real assistive technology, high contrast, display scaling, iOS and broader IME/application coverage remain open.

Synthetic screenshot candidates are generated under `dist/publication/`: mobile portrait/landscape/enlarged text and native light/dark preferences. Normal light/dark captures use Sans 11 (`preferences-light.png`, `preferences-dark.png`). Enlarged Sans 22 uses `preferences-dark-large-text.png` and is a stress preview, not a listing image. The captures were visually inspected. They contain no live pairing link. For publication, select the normal mobile portrait and normal-size light or dark preferences images and add a real desktop/phone pairing screenshot after physical acceptance.

## Physical acceptance checklist (maintainer)

Run these deliberately on your own setup; none was performed by the automated review.

1. Install the final ZIP, log out/in and configure networking. Expect the installed version in About and control off until Start.
2. Use a clean browser profile on the phone. Scan the QR and compare the browser certificate details with the PC fingerprint. Expect no control before desktop acknowledgement/approval; reject any mismatch.
3. Approve and try movement, clicks, two-finger scrolling, typing, correction and Enter in your usual applications. Record any keyboard/focus failures and the application/IME involved.
4. Remember the browser, Stop/Start manually, and reopen the plain PC address. Expect recovery without a new QR. Lock/unlock locally: expect disconnection and no service restart until you choose Start.
5. Forget the browser in Settings. Expect immediate disconnection and a fresh pairing requirement. Record phone/browser versions and pass/fail results.
