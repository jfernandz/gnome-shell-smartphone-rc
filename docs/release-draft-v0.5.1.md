# Smartphone Remote Control v0.5.1

Draft release text; not published. Publication is separate from extensions.gnome.org acceptance.

Control an unlocked GNOME desktop from a smartphone browser over your local network, with touchpad gestures, live typing, encrypted pairing and optional remembered browsers.

## Changes

- Escape private D-Bus socket paths, including temporary directories containing commas.
- Harden the development ZIP installer with one private archive snapshot, rollback of files/enablement, command timeouts, cancellation and direct-child reaping.
- Document safe cleanup of development snapshots and retained backups.

Development tools are separate from the runtime ZIP. Native pre-publication checks found additional installer fixes after the tag; use the corrected post-tag source tools rather than the tools at the v0.5.1 tag. The v0.5.1 runtime artifact is unchanged.

## Installation and support

Requires GNOME Shell 51 on Wayland, GJS, libsoup 3.8+, util-linux, OpenSSL and iproute2. Install the ZIP, log out/in, enable the extension and configure Settings → Network. See [README.md](../README.md) for pairing and certificate verification.

Tested in isolated GNOME 51.1 and Chromium. The final physical-phone acceptance, iOS and complete accessibility coverage remain pending. The network helper is not sandboxed; certificate identity is checked manually. See [the review report](publication-review.md).

Artifact: `smartphone-rc-0.5.1.zip`

```text
SHA256 8e1a93a7020848a5f129bc6fa9918ff4a13ed7da91dd37aefd5a2f5dfdba78d1
```

Screenshot candidates: generated files under `dist/publication/`; use normal mobile portrait and light preferences. Synthetic stress previews do not establish physical-device compatibility.
