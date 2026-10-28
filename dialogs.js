import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {CheckBox} from 'resource:///org/gnome/shell/ui/checkBox.js';
import {QrCode} from 'resource:///org/gnome/shell/ui/qrCode.js';

function fingerprintLabel(fingerprint) {
    const bytes = fingerprint.split(':');
    const lines = [];
    for (let index = 0; index < bytes.length; index += 8)
        lines.push(bytes.slice(index, index + 8).join(':'));
    return new St.Label({text: lines.join('\n'), x_align: Clutter.ActorAlign.CENTER});
}

export class RemoteDialogs {
    constructor() {
        this._pairing = null;
        this._pairingQr = null;
        this._certificate = null;
        this._verification = null;
    }

    closePairing() {
        if (this._pairing) {
            // GNOME 51 does not cancel QR generation when its actor is destroyed.
            this._pairingQr?._cancellable?.cancel();
            this._pairingQr = null;
            this._pairing.destroy();
            this._pairing = null;
        }
    }

    showPairing(url) {
        if (!url)
            return;
        this.closePairing();
        this._pairing = new ModalDialog.ModalDialog();
        this._pairing.contentLayout.add_child(new St.Label({text: 'Scan to connect'}));
        this._pairingQr = new QrCode({
            text: url, width: 280, height: 280, x_align: Clutter.ActorAlign.CENTER,
            style: 'background-color: white; color: black; padding: 24px;',
        });
        this._pairing.contentLayout.add_child(this._pairingQr);
        this._pairing.contentLayout.add_child(new St.Label({text: url.split('/#')[0]}));
        this._pairing.contentLayout.add_child(new St.Label({text: 'Scan with your phone and tap Connect.\nIn Lens, choose Open in Chrome.\nApprove the request in the PC menu.\nThis code expires after two minutes.'}));
        this._pairing.setButtons([{label: 'Close', action: () => this.closePairing()}]);
        this._pairing.open();
    }

    closeCertificate() {
        if (this._certificate) {
            this._certificate.destroy();
            this._certificate = null;
        }
    }

    showNetworkSetup(openSettings, reason) {
        this.closeCertificate();
        this._certificate = new ModalDialog.ModalDialog();
        this._certificate.contentLayout.add_child(new St.Label({text: 'Configure local networking'}));
        const label = new St.Label({text: 'Open Settings → Service → Network to choose the PC address\nand create its local certificate, then press Start again.'});
        this._certificate.contentLayout.add_child(label);
        console.info(`Smartphone Remote Control: network setup required: ${reason}`);
        this._certificate.setButtons([
            {label: 'Cancel', action: () => this.closeCertificate()},
            {label: 'Open Settings', action: () => { this.closeCertificate(); openSettings(); }},
        ]);
        this._certificate.open();
    }

    showFingerprint(fingerprint) {
        this.closeCertificate();
        this._certificate = new ModalDialog.ModalDialog();
        this._certificate.contentLayout.add_child(new St.Label({text: 'Local certificate — SHA-256'}));
        this._certificate.contentLayout.add_child(fingerprintLabel(fingerprint));
        this._certificate.setButtons([{label: 'Close', action: () => this.closeCertificate()}]);
        this._certificate.open();
    }

    closeVerification() {
        if (this._verification) {
            this._verification.destroy();
            this._verification = null;
        }
    }

    verifyCertificate(fingerprint, onConfirm) {
        this.closeVerification();
        const dialog = new ModalDialog.ModalDialog();
        this._verification = dialog;
        dialog.contentLayout.add_child(new St.Label({text: 'Verify the PC certificate'}));
        const help = new St.Label({text: 'Open certificate details in your phone browser.\nCompare its SHA-256 fingerprint with this one.\nA fingerprint displayed by a web page is not proof.'});
        dialog.contentLayout.add_child(help);
        dialog.contentLayout.add_child(fingerprintLabel(fingerprint));
        const checkbox = new CheckBox('The browser certificate fingerprint matches');
        dialog.contentLayout.add_child(checkbox);
        dialog.setButtons([
            {label: 'Cancel', action: () => this.closeVerification()},
            {label: 'Approve', action: () => {
                if (!checkbox.checked)
                    return;
                this.closeVerification();
                onConfirm();
            }},
        ]);
        const approve = dialog.buttonLayout.get_last_child();
        const update = () => {
            approve.reactive = approve.can_focus = checkbox.checked;
            if (checkbox.checked) approve.remove_style_pseudo_class('insensitive');
            else approve.add_style_pseudo_class('insensitive');
        };
        update();
        checkbox.connect('notify::checked', update);
        dialog.open();
    }

    destroy() {
        this.closeVerification();
        this.closePairing();
        this.closeCertificate();
    }
}
