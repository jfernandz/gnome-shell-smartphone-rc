import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {RemoteInput} from './input.js';
import {RemoteServer} from './server.js';

export default class SmartphoneRemoteControl extends Extension {
    enable() {
        this._server = null;
        this._input = null;
        this._indicator = new PanelMenu.Button(0.0, 'Smartphone Remote Control');
        this._indicator.add_child(new St.Icon({icon_name: 'input-touchpad-symbolic', style_class: 'system-status-icon'}));
        this._status = new PopupMenu.PopupMenuItem('Remote control is off', {reactive: false});
        this._indicator.menu.addMenuItem(this._status);
        this._indicator.menu.addAction('Start session', () => this._start());
        this._approve = this._indicator.menu.addAction('Approve phone', () => this._server.approve());
        this._approve.visible = false;
        this._indicator.menu.addAction('Stop / reject connection', () => this._stop());
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._lockId = Main.sessionMode.connect('updated', () => {
            if (Main.sessionMode.isLocked)
                this._stop();
        });
    }

    _start() {
        this._stop();
        try {
            this._input = new RemoteInput();
            this._server = new RemoteServer(this.path, state => {
                this._status.label.text = {
                    listening: 'Waiting for phone', pending: 'Phone requests control',
                    connected: 'Phone connected', disconnected: 'Disconnected — start a new session',
                }[state];
                this._approve.visible = state === 'pending';
                if (state === 'pending')
                    Main.notify('Smartphone Remote Control', 'A browser requests control. Open the top-bar menu to approve or reject it.');
            }, input => this._input.handle(input));
            this._url = this._server.start();
            // The development script reads this temporary URL through a user-only file.
            this._writeSessionFile();
        } catch (error) {
            this._stop();
            Main.notifyError('Smartphone Remote Control', error.message);
        }
    }

    _stop() {
        if (this._server) {
            this._server.stop();
            this._server = null;
        }
        if (this._input) {
            this._input.destroy();
            this._input = null;
        }
        this._removeSessionFile();
        this._url = null;
        this._approve.visible = false;
        this._status.label.text = 'Remote control is off';
    }

    _writeSessionFile() {
        Gio.File.new_for_path(`${GLib.get_user_runtime_dir()}/smartphone-rc-session`)
            .replace_contents(this._url, null, false, Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }

    _removeSessionFile() {
        GLib.unlink(`${GLib.get_user_runtime_dir()}/smartphone-rc-session`);
    }

    disable() {
        this._stop();
        Main.sessionMode.disconnect(this._lockId);
        this._indicator.destroy();
        this._indicator = null;
        this._status = null;
        this._approve = null;
    }
}
