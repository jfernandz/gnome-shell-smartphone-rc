# Reviewer follow-up draft

Not sent. Intended as a follow-up in the existing [architecture discussion](https://discourse.gnome.org/t/ego-submission-bundled-mobile-web-interface-and-gjs-network-helper/39605/4). Maintainer approval is required before sending.

---

Thanks for the guidance on separating the core and using D-Bus. The current implementation keeps one installable ZIP, with the network server and phone-browser assets grouped under `app/`.

The Shell extension starts a separate GJS helper and uses authenticated private peer D-Bus with UID/PID checks, typed bounded calls and lifecycle cleanup. The helper exits when the parent disappears. Shell and preferences do not import the application core; the worker imports no Shell/GTK UI. Developer install/reload tools and tests are excluded from the ZIP.

The browser interface is local, readable HTML/CSS/JavaScript without third-party web libraries. The helper serves it over HTTPS/WSS for touchpad and keyboard control, with desktop approval and optional revocable browser trust. The helper is resource-limited but not sandboxed.

Before submitting, could you confirm whether this bundled GJS helper and browser interface can be considered for review in this layout, or whether the core and web assets must be distributed separately?

Source: https://github.com/jfernandz/gnome-shell-smartphone-rc
