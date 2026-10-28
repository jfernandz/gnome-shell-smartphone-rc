# Publication readiness

Latest version: **v0.8.0**, adding confirmed remote lock and suspend actions.
Automated/browser and isolated native checks pass with injected power/lock
backends; the user reports the features work. The consolidated workflow
[passed for v0.7.0](https://github.com/jfernandz/gnome-shell-smartphone-rc/actions/runs/40767357581);
v0.8.0 still needs its hosted run. Earlier evidence is in the [v0.6.3 report](docs/publication-review-v0.6.3.md).
Tests, a tag or a GitHub release do not establish extensions.gnome.org approval.

## Prepare and retrieve artifacts

```sh
bash scripts/prepare-env.sh --install --publication
node scripts/prepare-publication.mjs v0.8.0
```

The default output is dist/publication-v0.8.0/: installable ZIP, selected portrait/landscape captures, icon, release notes, listing draft, checksums and REVIEW.md. Existing directories are preserved; use a new destination to repeat. See [script details](scripts/README.md#prepare-a-publication-from-a-tag).

On GitHub, **Actions → Release preparation → run → Summary → Artifacts** provides the bundle for 30 days. Tag runs attach only the installable ZIP and publication ZIP to a **draft** under Releases. Captures, icon, release notes and SHA256SUMS stay inside the publication ZIP. Its description contains the version's detailed changelog and comparison link. Manual runs regenerate artifacts without modifying releases. No workflow publishes drafts or submits to EGO.

Captures use synthetic approval/audio fixtures. Select and inspect the numbered candidates; diagnostic images may contain test-only editor text. Real device acceptance remains separate.

## Before submission

- Validate the final ZIP in an isolated GNOME Shell and on the supported phone, including certificate first use, typing, volume/output switching and lock/Stop cleanup.
- Review the source and static-analysis findings for that tag; the [last recorded analyzer run](SHEXLI.md) is v0.6.0.
- Confirm device/browser support, listing text and final screenshots; accessibility gaps are in [ACCESSIBILITY.md](ACCESSIBILITY.md).
- Confirm current EGO submission/review status before updating a listing. These reports do not establish that status.
- Publish or submit only when requested. Retain the exact submitted ZIP and its digest.

## Icon

The tracked [128×128 PNG](icons/smartphone-rc-icon.png) is a listing asset, excluded from the runtime ZIP. The [SVG](icons/remote-touchpad-symbolic.svg) is its source and the runtime icon:

```sh
magick -background none -density 2304 icons/remote-touchpad-symbolic.svg \
  -resize 128x128 -strip icons/smartphone-rc-icon.png
```

The generator renders it from the selected tag's SVG.

## Recorded architecture guidance

The [reviewer reply](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/4) prefers separate core distribution, recommends D-Bus and requests a dedicated directory for separately executed files if bundled. The [maintainer follow-up](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/5) records the move to private D-Bus/app/ and the decision to submit one self-contained ZIP. This consultation is complete; package acceptance remains the reviewer's decision.

Historical evidence: [v0.6.1](docs/publication-review-v0.6.1.md), [v0.6.0](docs/publication-review-v0.6.0.md), [earlier technical review](docs/publication-review.md). Current boundaries and checks: [SECURITY.md](SECURITY.md), [DBUS.md](DBUS.md), [TESTING.md](TESTING.md).
