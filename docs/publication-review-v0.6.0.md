# v0.6.0 submission preparation — 2026-10-27

Status: local preparation only. The GitHub release is now a published
**prerelease**; this is separate from submitting to extensions.gnome.org.
No reviewer message or extension submission has been sent by this preparation.
Maintainer acceptance and package approval remain open. The architecture
consultation is complete; see the updated status below.

## Exact artifact

Use the **smartphone-rc-0.6.0.zip** release asset, not GitHub's automatic
“Source code” archives:

- [Release](https://github.com/jfernandz/gnome-shell-smartphone-rc/releases/tag/v0.6.0)
- [Installable ZIP](https://github.com/jfernandz/gnome-shell-smartphone-rc/releases/download/v0.6.0/smartphone-rc-0.6.0.zip)
- Tag: `v0.6.0`; commit: `a388f29`.
- SHA-256: `70245e724f752cfc51d754cf3b473f4457bfc7e288951c2eef2d8988a005fab9`.
- Downloaded copy and local evidence: `dist/review-v0.6.0/`.

The release ZIP's digest matches GitHub's asset digest. ZIP integrity passes;
all 45 unique files match the runtime manifest and the tagged source byte for
byte. No development scripts, tests, npm dependencies, private keys, browser
credentials or compiled binaries are present. Metadata has the project UUID,
Shell 51 support, version-name 0.6.0, repository URL and clipboard declaration.
GPLv3 and the bundled Octicons MIT license are included. The standalone GJS
worker has the required `#!@GJS@ -m` header.

## Evidence

- GitHub CI passed with Node.js 22 and 24: lint, 91 automated tests, version-tag
  matching and ZIP generation. [Tag run](https://github.com/jfernandz/gnome-shell-smartphone-rc/actions/runs/40425073709).
- This downloaded release ZIP passed the isolated native installation,
  lifecycle and preferences harness. It checks rollback, fresh installations,
  ZIP replacement, native approval, helper crash, lock cleanup, pending
  startup cancellation and preferences behavior. The working desktop is not
  reloaded, locked or used for input by the harness.
- Chromium remembered-browser/accessibility checks passed through the real
  authenticated helper, including volume snapshots and volume/mute command
  return. Fixtures use synthetic audio state; they do not modify real audio.
- Mobile targets, accessible names and keyboard navigation pass at narrow,
  landscape and enlarged-text sizes; native light/dark/large-text/narrow
  preferences checks pass. This does not establish real screen-reader,
  high-contrast or physical scaling behavior.
- A fresh 30-second TLS load run plus the harness's recovery period passed:
  400 incomplete connections, 160 HTTPS requests and 72 HTTP 200 responses
  during saturation. Peak RSS 56,820 KiB; final RSS growth 1,628 KiB;
  descriptors peaked at 43 and returned to the baseline of 11. This verifies
  bounded rejection/recovery in one loopback fixture, not uninterrupted
  availability, long-term leak freedom or an exhaustive denial-of-service audit.
  Full measurements are in `soak.txt`.

### Focused source inspection

This is an assistant-assisted review, not independent security certification
or maintainer sign-off. The inspection checked these paths:

| Area | Observed implementation and limit |
| --- | --- |
| Initialization | Shell-owned objects and connections are created from enable/start/session transitions, rather than module initialization. The standalone worker is a separate process entry point. |
| Stop/disable/lock | Stop destroys input/focus/audio observers, closes dialogs, cancels startup and stops the helper. disable additionally releases settings, session-mode and indicator resources. Existing native regressions exercise these paths. |
| Audio ownership | RemoteVolume tracks its own mixer/stream signal IDs and timer, releases them on leaving connected, and never closes GNOME's shared mixer. Native tests verify observer creation; unit tests cover switches, missing outputs, cleanup and stale IDs. |
| Audio bounds | Shell validates input independently. Integer percentages are limited to 0–100, mute is boolean and output IDs are uint32. Unmute caps an amplified output at 100%; stale default-output IDs are ignored. |
| Authentication | The helper checks approval/session state before forwarding input; suspended sessions cannot forward audio commands. Shell accepts input only while connected and checks it again. |
| Process boundary | Private D-Bus uses same-user authentication plus UID/PID verification, bounded typed calls, queue/rate limits and deadlines. Child resource limits are not an OS sandbox. |
| Clipboard | Only the explicit Copy pairing link action writes to the clipboard; metadata declares it. No clipboard read was found. |
| Separate imports | The worker imports no Shell/GTK UI; Shell/preferences do not import the application core. Packaging/import-graph tests cover these boundaries. |
| Reviewable source | Runtime source is unminified. Browser assets are served locally without third-party browser libraries or downloaded executable code. Their eligibility for EGO review still needs a reviewer decision. |

### Static analyzer: six findings remain

Toolchain: shexli 0.2.1, tree-sitter 0.25.2,
tree-sitter-javascript 0.25.0. Full output: `shexli.txt` in the evidence directory.
No analyzer rules were changed or suppressed. Its exit status is not treated
as proof of approval: the output reports **issues_found**, two errors,
three warnings and one manual-review finding.

| Rule | Current disposition |
| --- | --- |
| EGO-M-004, error | The pinned analyzer rejects Shell majors above 50. The package truthfully targets Shell 51 and native checks run on 51.1. Do not claim older untested support to silence it. |
| EGO-P-002, error | The browser schema is relocatable; trusted.js supplies paths under `/org/gnome/shell/extensions/smartphone-rc/browsers/`. A fixed schema path would break per-browser instances. Strict compilation and revocation tests pass. |
| EGO-P-007, warning | Worker and browser files are separate executable entry points, not dead imports. The manifest and runtime tests account for them; the architecture consultation is complete; package acceptance still belongs to the actual review. |
| EGO-L-002, warning | Indicator-menu ownership destroys the three reported rows; isolated native tests observe their destruction. |
| EGO-L-003, warning | The destroy handler belongs to the owned notification; Stop clears actions and destroys the notification, which releases its signals. |
| EGO-A-005, manual | Explicit clipboard write is declared and needs reviewer scrutiny. |

See [SHEXLI.md](../SHEXLI.md) for the existing explanations and source references.

## Architecture consultation — complete

The [reviewer reply](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/4)
prefers an externally distributed core, recommends D-Bus, permits Soup for
local-IP service use, and explicitly discusses the bundled option with a
dedicated directory for files running outside Shell. The project already uses
private D-Bus and app/ for the helper and browser client.

The [maintainer's follow-up](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/5)
confirms those changes and the decision to submit a self-contained ZIP.
Both posts were read directly via the public Discourse JSON endpoint on
2026-10-27. The architecture consultation is complete: no additional message
is required before submission. The [earlier follow-up draft](reviewer-message-draft.md)
is superseded and should not be sent.

The [general guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#scripts-and-binaries)
still describe the review-scope concern. The thread supplies project-specific
guidance for proceeding with a bundled submission; it does not approve the
v0.6.0 ZIP in advance. If the actual review requests a separate core, revisit
installation/distribution then.

## Maintainer actions

Use the downloaded release ZIP for these checks, not the source reload helper.
Record a result and any error for each row; leave unavailable devices untested.
The checklist is acceptance evidence, not a claim that EGO formally requires
every hardware/browser combination.

Environment to record: distribution, GNOME/Wayland version, phone model/OS,
browser/version and audio outputs used.

| Check | Result |
| --- | --- |
| Install the release ZIP normally; after a fresh login, About reports 0.6.0 and control is off until Start. Save work before logging out. | Pending |
| With a clean phone browser profile, scan the QR and compare the browser certificate's SHA-256 fingerprint with the PC. Input remains unavailable until desktop acknowledgement/approval. | Pending |
| Move, click, scroll, type, correct and press Enter in the applications you normally use. Record application/IME-specific failures. | Pending |
| Play quiet audio; adjust volume in both directions from phone and PC. Verify synchronization, mute/unmute and the 100% remote ceiling. | Pending |
| Switch between your available speakers/headphones/Bluetooth while connected. Verify the phone follows the default output, and reconnect after an output disappears. Mark hardware you do not own as untested. | Pending |
| Remember the browser; Stop/Start and reconnect. Forget it in Settings; expect immediate disconnection and fresh pairing. | Pending |
| Lock/unlock locally; expect disconnection and no automatic service restart. Test Stop and disable during a connection. | Pending |
| Try your actual display scale/high-contrast settings and screen reader if available; record limitations rather than claiming support. | Pending |

Also:

- Read through the code paths in the table above, especially approval,
  credential revocation, input injection and cleanup. Be able to explain the
  implementation and its use of AI development tools. This understanding is
  the maintainer's responsibility; an automated report cannot supply it.
- Architecture consultation is already complete in the Discourse thread;
  retain that link in the submission notes. No further follow-up is pending.
- Choose the listing text and screenshots, then upload the installable ZIP
  using your extensions.gnome.org account when you decide to submit.

## Listing text draft

Name: **Smartphone Remote Control**

Use your smartphone browser as a touchpad and keyboard for an unlocked GNOME
desktop on your local network. Control the default audio output's volume and
mute state, with desktop changes reflected on the phone.

Pair using a temporary QR code, verify the local HTTPS certificate and approve
new browsers on the desktop. Optionally remember browsers and revoke their
access in Settings. Locking the desktop, stopping control or disabling the
extension ends remote control. Pairing links are copied to the clipboard only
when you explicitly choose Copy pairing link.

Requires GNOME Shell 51, GJS, libsoup 3.8+, util-linux/prlimit, OpenSSL and
iproute2. No mobile application is needed. Both devices must be able to reach
each other over the local network. Setup uses a self-signed certificate and
does not configure the firewall. Android/Chrome is the initial target; iOS
Safari remains unvalidated. No screen streaming, internet relay, microphone
capture or lock-screen control is provided.

Repository: https://github.com/jfernandz/gnome-shell-smartphone-rc

## Screenshot candidates

Fresh captures are under `dist/review-v0.6.0/screenshots/`:

- `mobile-360x800-16px.png`: mobile control page, including volume. Visually
  inspected; synthetic connection/audio state, no pairing secret displayed.
- `preferences-dark-pointer.png`: native pointer settings. Visually inspected;
  no pairing link or browser credential displayed.
- Other light/dark/narrow/enlarged-text captures are test evidence, not all
  intended as listing images.

An actual phone/desktop usage capture is still optional maintainer material;
never expose a live QR, pairing URL fragment, cookie or private key.
