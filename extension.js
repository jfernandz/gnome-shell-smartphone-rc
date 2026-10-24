import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import {TrustedBrowsers} from './trusted.js';
import {sensitivityRange} from './settings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {RemoteDialogs} from './dialogs.js';

import {RemoteInput} from './input.js';
import {TextFocus} from './focus.js';
import {RemoteServer} from './server.js';
import {isPrivateIPv4} from './network.js';

export default class SmartphoneRemoteControl extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._trusted = new TrustedBrowsers(this._settings);
        this._notification = null;
        this._server = null;
        this._input = null;
        this._focus = null;
        this._dialogs = new RemoteDialogs();
        this._indicator = new PanelMenu.Button(0.0, 'Smartphone Remote Control');
        this._indicator.add_child(new St.Icon({icon_name: 'input-touchpad-symbolic', style_class: 'system-status-icon'}));
        this._status = new PopupMenu.PopupMenuItem('Remote control is off', {reactive: false});
        this._indicator.menu.addMenuItem(this._status);
        this._indicator.menu.addAction('Start Wi-Fi service', () => this._start()).add_style_class_name('smartphone-rc-connect');
        this._address = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._address.visible = false;
        this._indicator.menu.addMenuItem(this._address);
        this._pairing = this._indicator.menu.addAction('Show pairing QR', () => this._showPairing());
        this._pairing.visible = false;
        this._copy = this._indicator.menu.addAction('Copy pairing link', () => {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this._url);
            Main.notify('Smartphone Remote Control', 'Pairing link copied. Open it on the phone before it expires.');
        });
        this._copy.visible = false;
        this._showCertificate = this._indicator.menu.addAction('Show certificate fingerprint', () => this._dialogs.showFingerprint(this._fingerprint));
        this._showCertificate.visible = false;
        this._remember = new PopupMenu.PopupSwitchMenuItem('Remember this browser for 90 days', false);
        this._remember.visible = false;
        this._indicator.menu.addMenuItem(this._remember);
        this._approve = this._indicator.menu.addAction('Approve phone', () => this._server?.approve(this._remember.state));
        this._approve.add_style_class_name('smartphone-rc-approve');
        this._approve.visible = false;
        this._indicator.menu.addAction('Disconnect / reject', () => this._server?.disconnect()).add_style_class_name('smartphone-rc-stop');
        this._indicator.menu.addAction('Stop service', () => this._stop()).add_style_class_name('smartphone-rc-stop');
        this._indicator.menu.addAction('Settings', () => this.openPreferences());
        this._settingsId = this._settings.connect('changed', (_settings, key) => {
            if (key === 'trusted-browsers')
                this._server?.checkTrust();
            else
                this._server?.setSensitivity(sensitivityRange(this._settings));
        });
        this._pairing.add_style_class_name('smartphone-rc-connect');
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._lockId = Main.sessionMode.connect('updated', () => {
            if (Main.sessionMode.isLocked)
                this._stop();
        });
    }

    _start() {
        this._stop();
        try {
            const options = this._networkOptions();
            this._fingerprint = options.certificate
                ? GLib.compute_checksum_for_data(GLib.ChecksumType.SHA256, options.certificate.certificate).toUpperCase().match(/.{2}/g).join(':')
                : null;
            this._showCertificate.visible = Boolean(this._fingerprint);
            this._input = new RemoteInput(message => {
                this._server.send({type: 'typing-paused', message});
                Main.notify('Smartphone Remote Control', `${message} Click the text field again to resume.`);
            });
            this._server = new RemoteServer(this.path,
                state => this._onSessionState(state),
                input => this._handleInput(input), {...options, trusted: this._trusted, sensitivity: sensitivityRange(this._settings)});
            this._url = this._server.start();
            this._address.label.text = this._url.split('/#')[0];
            this._address.visible = true;
            this._copy.visible = true;
            this._pairing.visible = true;
            // The development script reads this temporary URL through a user-only file.
            this._writeSessionFile();
            this._dialogs.showPairing(this._url);
        } catch (error) {
            this._stop();
            Main.notifyError('Smartphone Remote Control', error.message);
        }
    }

    _onSessionState(state) {
        if (state === 'reconnecting')
            console.info('Smartphone Remote Control: phone transport interrupted; waiting for reconnection.');
        this._status.label.text = {
            listening: 'Waiting for phone', pending: `Control requested from ${this._server.peer}`,
            connected: `Connected: ${this._server.browserName ?? this._server.peer}`, disconnected: 'Disconnected',
            expired: 'Invitation or session expired',
            suspended: 'Phone paused in background', reconnecting: 'Waiting for phone to reconnect',
        }[state];
        if (this._focus) {
            this._focus.destroy();
            this._focus = null;
        }
        this._input?.cancelKeyboard();
        if (state === 'connected') {
            this._focus = new TextFocus(message => {
                this._input.resumeKeyboard();
                this._server.send(message);
            });
        }
        this._clearNotification();
        this._approve.visible = state === 'pending';
        this._remember.visible = state === 'pending';
        if (state === 'pending')
            this._remember.setToggleState(false);
        if (state !== 'listening') {
            this._dialogs.closePairing();
        }
        this._pairing.visible = state !== 'pending';
        this._pairing.label.text = state === 'listening' ? 'Show pairing QR' : 'New pairing QR';
        if (['connected', 'disconnected', 'expired'].includes(state)) {
            this._copy.visible = false;
            this._url = null;
            this._removeSessionFile();
        }
        if (state === 'pending')
            this._notifyRequest();
    }

    _clearNotification() {
        if (this._notification) {
            const notification = this._notification;
            this._notification = null;
            notification.clearActions();
            notification.destroy();
        }
    }

    _notifyRequest() {
        const server = this._server;
        const notification = new MessageTray.Notification({
            source: MessageTray.getSystemSource(), title: 'Remote control requested',
            body: `A browser at ${server.peer} requests control. Remembering it allows access for 90 days while the service is running.`,
            iconName: 'input-touchpad-symbolic', resident: true,
        });
        this._notification = notification;
        notification.connect('destroy', () => {
            if (this._notification === notification)
                this._notification = null;
        });
        notification.addAction('Accept', () => {
            if (this._server === server)
                server.approve(false);
        });
        notification.addAction('Accept and remember', () => {
            if (this._server === server)
                server.approve(true);
        });
        notification.addAction('Reject', () => {
            if (this._server === server)
                server.disconnect();
        });
        notification.source.addNotification(notification);
    }

    _showPairing() {
        if (this._url)
            this._dialogs.showPairing(this._url);
        else
            this._start();
    }

    _handleInput(input) {
        if (input.type === 'edit' || input.type === 'key') {
            if (!this._focus)
                return;
            this._focus.refresh();
            if (input.context !== this._focus.context)
                return;
        }
        this._input.handle(input);
        if (input.type === 'click' && this._focus)
            this._focus.reset();
    }

    _networkOptions() {
        const directory = `${GLib.get_user_config_dir()}/smartphone-rc`;
        if (!GLib.file_test(`${directory}/network.json`, GLib.FileTest.EXISTS))
            throw new Error('Wi-Fi has not been configured. Follow the network setup steps in README.');
        const [, contents] = GLib.file_get_contents(`${directory}/network.json`);
        const {address} = JSON.parse(new TextDecoder().decode(contents));
        if (!isPrivateIPv4(address))
            throw new Error('The configured address must be a private LAN IPv4 address.');
        const certificate = Gio.TlsCertificate.new_from_files(`${directory}/certificate.pem`, `${directory}/private-key.pem`);
        const errors = certificate.verify(new Gio.NetworkAddress({hostname: address, port: 8844}), null);
        const invalid = Gio.TlsCertificateFlags.BAD_IDENTITY | Gio.TlsCertificateFlags.EXPIRED | Gio.TlsCertificateFlags.NOT_ACTIVATED;
        if (errors & invalid)
            throw new Error('The local certificate is expired or does not match the LAN address. Run network setup again.');
        return {address, certificate};
    }

    _stop() {
        this._clearNotification();
        if (this._focus) {
            this._focus.destroy();
            this._focus = null;
        }
        this._dialogs.destroy();
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
        this._address.visible = false;
        this._copy.visible = false;
        this._pairing.visible = false;
        this._showCertificate.visible = false;
        this._fingerprint = null;
        this._approve.visible = false;
        this._remember.visible = false;
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
        this._settings.disconnect(this._settingsId);
        this._settings = null;
        this._trusted = null;
        Main.sessionMode.disconnect(this._lockId);
        this._indicator.destroy();
        this._indicator = null;
        this._dialogs = null;
        this._status = null;
        this._approve = null;
        this._remember = null;
        this._address = null;
        this._copy = null;
        this._pairing = null;
        this._showCertificate = null;
    }
}
