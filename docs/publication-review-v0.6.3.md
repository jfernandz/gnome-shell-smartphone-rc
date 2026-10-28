# v0.6.3 hosted publication preparation — 2026-10-28

Status: automated preparation passed in GitHub Actions. This is not a manual
code review, physical-device acceptance or extensions.gnome.org approval.

- Tag: `v0.6.3`; commit: `b9e2d4c173a663468fa646370b81c8220fdb26b3`.
- [Publication workflow](https://github.com/jfernandz/gnome-shell-smartphone-rc/actions/runs/40754689955): passed.
- [Preparation bundle](https://github.com/jfernandz/gnome-shell-smartphone-rc/actions/runs/40754689955/artifacts/12844589055): `publication-v0.6.3`, retained for 30 days.
- [Tag CI](https://github.com/jfernandz/gnome-shell-smartphone-rc/actions/runs/40754689874): lint and all 93 automated tests pass with Node 22 and 24; draft-release creation also passes.
- Preparation separately runs the tagged 93 tests and Chromium remembered-browser/accessibility checks, verifies ZIP integrity and all 45 entries against tagged source, and generates screenshots and a PNG icon.
- The previously failing 320×568/200%-text check now passes with the CI fonts.
- Installable ZIP in this preparation bundle: `smartphone-rc-0.6.3.zip`.
- ZIP SHA-256: `1863e9f127ba2d4a2066153857d013b4b583e5618c6e0fedd17507119ca27b90`.

The bundle was downloaded to `dist/publication-v0.6.3-github/`, and every
entry in SHA256SUMS verified. The numbered portrait-controls and
landscape-touchpad candidates were visually inspected. They use synthetic
loopback approval/audio fixtures, without browser chrome or pairing URLs.
Other harness captures are diagnostic material, not selected listing images.

The preparation generator records lint as pending because it does not run
ESLint itself; the separate successful tag CI supplies that evidence. Its
copied documentation is the tagged snapshot and predates this hosted result.
The GitHub draft-release ZIP is built separately and can have different ZIP
timestamps/digest; verify the specific artifact being submitted.

The earlier v0.6.2 runs remain failed: the first lacked a working container
browser launch, and the next exposed genuine controls-card overflow with tall
fonts. Its immutable tag is unchanged; the UI correction is in v0.6.3.

Still pending: maintainer/manual source review, static analysis for this tag,
packaged isolated GNOME Shell acceptance, physical phone and certificate
first-use checks, listing approval, EGO submission and EGO package review.
No EGO submission or public release publication was performed here.
