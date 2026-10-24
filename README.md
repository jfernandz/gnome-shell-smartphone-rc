# Smartphone Remote Control

A GNOME Shell extension for controlling your desktop from a smartphone browser. The intended workflow is to scan a QR code, connect over Wi-Fi, approve the phone on your desktop, and use it as a touchpad and keyboard. No mobile app is required.

**Status: initial prototype for GNOME Shell 51 (development host: 51.1, Wayland).** Desktop input, browser controls, and session approval are implemented. Wi-Fi access, QR pairing, and continuous mobile text input are still in development. See [PLAN.md](PLAN.md).

## Current features

- A top-bar menu to start, approve, reject, and stop sessions.
- A mobile web touchpad with relative motion, tap to click, explicit left/right click buttons, and experimental two-finger scrolling.
- A native mobile keyboard with a text field and Send button, plus Enter, Backspace, Tab, and Escape.
- One browser connection at a time, temporary pairing links, and explicit desktop approval.
- The service stops when the extension is disabled or the desktop locks.

## Security and limitations

The prototype currently listens only on IPv4 loopback (`127.0.0.1:8844`) and is accessible through the development harness described below. LAN access and its transport security design are pending; the intended Wi-Fi workflow is not available yet.

Pairing links expire after two minutes. Pending approval expires after 30 seconds. The token is invalidated on approval, and every connection needs desktop approval. Browser origins are checked and control messages are bounded, validated, and rate limited. The temporary pairing URL is stored in a user-private runtime file and removed on stop. Browser labels do not establish a hardware identity.

The text field sends committed text in batches. Text uses GNOME's input method where available, with a virtual-keyboard fallback that depends on the active layout; arbitrary Unicode and emoji support are not promised. Dragging, modifier shortcuts, and live synchronization with autocorrection are not implemented. Actual device and Shell integration results are recorded in [TESTING.md](TESTING.md).

The small libsoup server currently runs in the Shell process. Re-evaluate process isolation before adding LAN exposure or substantial server work. This is not yet a release ready for extensions.gnome.org.

## Development

### Run the development prototype

The current development harness uses ADB forwarding to a loopback-only server while Wi-Fi support is being built. Requirements: GNOME Shell 51, GJS, libsoup 3, and Android platform tools (`adb`). Enable USB debugging on your Android phone and authorize your PC. Chrome is the initial mobile browser target.

```sh
bash scripts/install.sh
# Log out and back in after first installation on Wayland.
gnome-extensions enable smartphone-rc@jfaparicio.github.io
```

1. Open the touchpad icon in the top bar and choose **Start session**.
2. Connect the phone over USB, then run `bash scripts/open-phone.sh`.
3. Tap **Connect** on the phone.
4. Open the PC top-bar menu and choose **Approve phone**.
5. Move a finger over the black touchpad. Use **Keyboard** to type text and **Send** to transmit it to the focused desktop field.

To reconnect, start a new session and run the phone script again. Refreshing the page clears the pairing link deliberately; generate a fresh session. Disconnecting does not retain authorization.

Remove USB forwarding when finished:

```sh
adb reverse --remove tcp:8844
```

No npm packages or build step are required. Node.js 22+ runs the test harness; GJS and libsoup 3 run the actual server integration test:

```sh
node --test tests/*.test.js
```

The GJS server fixture automatically approves test connections and never injects desktop input. It is exclusively a test harness and is not installed with the extension.

After changing installed extension code, log out and back in on Wayland, or test in an isolated development Shell. Logs are available with `journalctl --user -f -o cat`.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
