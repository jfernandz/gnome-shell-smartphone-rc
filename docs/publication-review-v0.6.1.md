# v0.6.1 publication preparation — 2026-10-28

Status: local automated preparation, not a completed manual source review or
approval from extensions.gnome.org. Nothing was submitted or published by
this preparation. External submission/review status has not been queried.

## Exact source and artifact

- Tag: `v0.6.1`; commit: `26f13d40b380aa8ca062f1c72b731d88a2fef90d`.
- Installable ZIP: `smartphone-rc-0.6.1.zip`.
- SHA-256 of this generated ZIP: `098d44b67bf8a0e7011692fd85a358f13c696683bf7175d5491b7ad781a844e3`.
- Local bundle: `dist/publication-v0.6.1/`; full report: `REVIEW.md`.
- All 45 ZIP entries match the tagged runtime manifest and source bytes.

ZIP container timestamps can change between builds; use the SHA-256 emitted
by the specific run being submitted. Do not assume this digest matches a
separately built GitHub release asset.

## Completed evidence

- All 93 tagged automated tests passed.
- Tagged Chromium remembered-browser/accessibility checks passed through the
  real loopback D-Bus helper.
- ZIP integrity and exact manifest/source comparison passed.
- Portrait controls and landscape touchpad screenshot candidates were
  generated from the tag and visually inspected. They show only web content,
  without a browser address bar or pairing URL. Approval and audio state are
  synthetic fixtures, not physical-device acceptance.
- Transparent 128×128 PNG icon, tagged release notes, listing draft, logs,
  source documentation, evidence.json and SHA256SUMS were generated.
- ESLint passes on the working checkout, including the new generator. The
  generator does not install dependencies or claim a fresh tagged lint run.

## Reproduce

```sh
node scripts/prepare-publication.mjs v0.6.1
# To repeat without replacing the previous evidence:
node scripts/prepare-publication.mjs v0.6.1 dist/publication-v0.6.1-repeat
```

See [script instructions](../scripts/README.md#prepare-a-publication-from-a-tag).
The generator uses a private archive of the tag; it does not reload the
working desktop, move tags or modify release files. A failed run leaves
INCOMPLETE.txt and logs. Successful runs refuse to overwrite earlier output.

## Pending

- [ ] Review code and current static-analyzer findings for this tag.
- [ ] Validate the packaged build in an isolated GNOME Shell.
- [ ] Complete physical-phone, real keyboard, display-cutout and first-use
      certificate-warning acceptance for the final package.
- [ ] Confirm supported device/browser details and final listing text/images.
- [ ] Submit/update extensions.gnome.org only when requested; await its review.

The Publication preparation workflow runs on pushed version tags or manually
with an existing tag. It uploads a preparation artifact, including failure
logs where available, without creating or publishing an EGO submission.
Its hosted execution remains unvalidated until the workflow is committed and
run on GitHub. The separate CI workflow still owns GitHub draft releases.
