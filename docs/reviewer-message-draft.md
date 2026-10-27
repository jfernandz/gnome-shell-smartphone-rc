# Archived reviewer follow-up draft — superseded

Do not send: this draft is superseded by the existing
[reviewer guidance](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/4)
and [maintainer follow-up](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/5).
The architecture consultation is complete. The project will submit the bundled
ZIP with D-Bus and app/ separation; acceptance of the actual package remains
subject to review. The old proposed message is retained below as history.

---

Thanks for the guidance on separating the core and using D-Bus. The v0.6.0 implementation keeps one installable ZIP, with the network server and phone-browser assets grouped under `app/`.

The Shell extension starts a separate GJS helper and uses authenticated private peer D-Bus with UID/PID checks, typed bounded calls and lifecycle cleanup. The helper exits when the parent disappears. Shell and preferences do not import the application core; the worker imports no Shell/GTK UI. Developer install/reload tools and tests are excluded from the ZIP.

The browser interface is local, readable HTML/CSS/JavaScript without third-party web libraries. The helper serves it over HTTPS/WSS for touchpad, keyboard and default-output volume/mute control, with desktop approval and optional revocable browser trust. The helper is resource-limited but not sandboxed.

Before submitting, could you confirm whether this bundled GJS helper and browser interface can be considered for review in this layout, or whether the core and web assets must be distributed separately?

Source at the reviewed tag: https://github.com/jfernandz/gnome-shell-smartphone-rc/tree/v0.6.0
Installable ZIP: https://github.com/jfernandz/gnome-shell-smartphone-rc/releases/download/v0.6.0/smartphone-rc-0.6.0.zip

The current static analysis still flags these separate entry points, plus the
relocatable browser schema and Shell 51 metadata; we have documented the
reasons rather than suppressing the checks. We understand that grouping files
under app/ does not by itself resolve the guideline about HTML/web JavaScript.
No acceptance of this architecture is assumed.
