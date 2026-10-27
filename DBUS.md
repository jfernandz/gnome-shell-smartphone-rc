# Private D-Bus service boundary

Shell and the network child use authenticated private peer-to-peer D-Bus over a Unix socket. Both ship in one package; there is no session-bus service, activation file or automatic startup. Introduced in v0.5.0.

## Process layout

- extension.js, dialogs.js, focus.js, input.js and volume.js run in GNOME Shell.
- service.js is the Shell-side process owner and D-Bus controller.
- app/service-worker.js runs in the bounded GJS child and owns app/server.js and app/network-guard.js.
- app/web/ contains the phone-browser HTML/CSS/JavaScript.
- dbus.js is a shared GIO-only transport/contract module. Protocol validation, limits, settings and trusted-browser storage remain shared where needed; none of these imports Shell UI into the network child.
- prefs.js and preferences/ remain the native GTK preferences process.

The runtime manifest declares shipped paths. Tests keep app code out of Shell/preferences imports and Shell/input/GTK UI out of the worker.

## Connection and identity

1. The controller creates a mode-0700 temporary directory and a Unix socket, with D-Bus same-user authentication required.
2. It spawns the existing prlimit-constrained child, passing the private address, parent PID and socket directory. No pairing secret or typed text is passed on the command line.
3. The controller checks the connecting process's Unix UID and PID against the actual child process. An unrelated process from the same user is rejected, including before the expected child connects.
4. The child checks Unix socket credentials against its expected parent UID/PID before accepting control methods. On Linux this uses the socket's credentials: GDBusConnection.get_peer_credentials() does not supply server credentials to a client connection.
5. Both sides export their typed interfaces. The child sends Ready, the controller sends Start, and the child reports Listening/Started before an established session can deliver input.
6. After accepting the child, the listener stops accepting connections. Communication remains on that authenticated private connection.

There is no publicly owned bus name or broadcast signal. These checks reduce accidental/unrelated access; they are not an OS sandbox against malicious software already controlling the same account.

## Interface

Object path: /io/github/jfernandz/SmartphoneRC. All methods reply with an empty acknowledgement. Values crossing the connection use native D-Bus types, not JSON strings or a custom line/framing parser.

| Interface | Methods | Direction |
| --- | --- | --- |
| io.github.jfernandz.SmartphoneRC.Control1 | Start(a{sv}), Approve(b), Disconnect(), Sensitivity(dd), Focus(bbd), TypingPaused(s), Volume(bddb) | Shell → child |
| io.github.jfernandz.SmartphoneRC.Events1 | Ready(), Started(ss), State(sss), Input(a{sv}), Failed(s) | Child → Shell |

Start carries bounded configuration dictionaries. Input carries a dictionary of validated control fields. Nested dictionaries are bounded; numeric dictionary values use doubles and existing integer/safe-integer checks still apply where appropriate. Empty strings represent absent optional state/fingerprint labels because D-Bus has no null type. Pairing secrets and input travel only through directed calls on this private peer connection.

Volume carries output availability, the current output ID, a 0–100 percentage and mute state. Output IDs use doubles with integer/uint32 validation; -1 represents no output. Volume/mute input carries the intended output ID so delayed commands cannot change a new default sink. Only connected sessions own mixer observers; state updates are coalesced to at most 20 per second.

Shell validates startup ordering, URL/address/certificate details and every input event independently. Desktop approval and cookie/trust decisions remain in the existing state machine. Selecting D-Bus does not itself authorize a browser.

## Bounds and cleanup

- At most 4096 serialized bytes per application method argument tuple.
- Up to 64 queued outgoing calls plus one awaiting acknowledgement.
- Up to 512 incoming application calls per second per peer.
- Five-second call deadline and eight-second helper-startup deadline.
- Existing network limits, child data/descriptor limits and Shell-side input limits remain in force.

The size check runs after GDBus receives/deserializes the native message. It is not a pre-allocation byte cap. Only the authenticated private peer reaches application dispatch; no claim is made of exhaustive native D-Bus parser or same-user denial-of-service resilience.

Stop, disable, lock, malformed/excessive requests, connection loss and helper failure stop control. Closing or killing the parent closes the connection; the helper stops its listener and exits. Cancellation during startup closes the listener and removes its socket directory. Normal stop and the parent-disappearance path clean up the temporary socket directory. No automatic restart or privilege elevation is introduced.

## Validation

See [TESTING.md](TESTING.md) for automated identity/contract/limits tests, browser coverage and earlier isolated Shell checks. v0.5.1 adds real helper startup with a comma-containing temporary path, escaped using `Gio.dbus_address_escape_value()`.

References: [GJS D-Bus guide](https://gjs.guide/guides/gio/dbus.html), [GIO peer credentials](https://docs.gtk.org/gio/method.DBusConnection.get_peer_credentials.html), and [maintainer feedback](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/4). See [SECURITY.md](SECURITY.md) for the wider threat model.
