import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {QrCode} from 'resource:///org/gnome/shell/ui/qrCode.js';

export class RemoteDialogs {
    constructor() {
        this._pairing = null;
        this._certificate = null;
    }

    closePairing() {
        if (this._pairing) {
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
        this._pairing.contentLayout.add_child(new QrCode({
            text: url, width: 280, height: 280, x_align: Clutter.ActorAlign.CENTER,
            style: 'background-color: white; color: black; padding: 24px;',
        }));
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

    showFingerprint(fingerprint) {
        this.closeCertificate();
        this._certificate = new ModalDialog.ModalDialog();
        this._certificate.contentLayout.add_child(new St.Label({text: 'Local certificate — SHA-256'}));
        const bytes = fingerprint.split(':');
        const lines = [];
        for (let i = 0; i < bytes.length; i += 8)
            lines.push(bytes.slice(i, i + 8).join(':'));
        this._certificate.contentLayout.add_child(new St.Label({
            text: lines.join('\n'),
            x_align: Clutter.ActorAlign.CENTER,
        }));
        this._certificate.setButtons([{label: 'Close', action: () => this.closeCertificate()}]);
        this._certificate.open();
    }

    destroy() {
        this.closePairing();
        this.closeCertificate();
    }
}
