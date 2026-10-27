import GLib from 'gi://GLib';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import {validateInput} from './protocol.js';

export class RemoteVolume {
    constructor(onState, control = Volume.getMixerControl()) {
        this._onState = onState;
        this._control = control;
        this._stream = null;
        this._streamIds = [];
        this._timer = 0;
        this._controlIds = ['default-sink-changed', 'stream-removed', 'state-changed']
            .map(signal => control.connect(signal, () => this._sync()));
        this._sync();
    }

    _sync() {
        const stream = this._control.get_default_sink();
        if (stream !== this._stream) {
            this._disconnectStream();
            this._stream = stream;
            if (stream) {
                this._streamIds = ['notify::volume', 'notify::is-muted']
                    .map(signal => stream.connect(signal, () => this._schedule()));
            }
        }
        this._schedule();
    }

    _schedule() {
        if (this._timer) return;
        // Bound state traffic while either the desktop or phone drags a slider.
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            this._timer = 0;
            const stream = this._stream;
            const maximum = this._control.get_vol_max_norm();
            const available = Boolean(stream) && maximum > 0;
            this._onState({type: 'volume-state', available,
                output: available ? stream.get_id() : -1,
                level: available ? Math.max(0, Math.min(100, Math.round(stream.volume / maximum * 100))) : 0,
                muted: available ? Boolean(stream.is_muted) : false});
            return GLib.SOURCE_REMOVE;
        });
    }

    handle(message) {
        const input = validateInput(message);
        if (!this._control || !input || !['volume', 'mute'].includes(input.type)) return;
        this._sync();
        const stream = this._stream;
        // Ignore delayed commands for an output that is no longer the default.
        if (!stream || input.output !== stream.get_id()) return;
        const maximum = this._control.get_vol_max_norm();
        if (!(maximum > 0)) return;
        if (input.type === 'volume') {
            if (stream.set_volume(Math.round(input.level / 100 * maximum)))
                stream.push_volume();
            stream.change_is_muted(input.level === 0);
        } else {
            // Unmuting must not expose a locally amplified volume above our cap.
            if (!input.muted && stream.volume > maximum && stream.set_volume(maximum))
                stream.push_volume();
            stream.change_is_muted(input.muted);
        }
        this._schedule();
    }

    _disconnectStream() {
        for (const id of this._streamIds) this._stream.disconnect(id);
        this._streamIds = [];
        this._stream = null;
    }

    destroy() {
        if (this._timer) GLib.Source.remove(this._timer);
        this._timer = 0;
        this._disconnectStream();
        for (const id of this._controlIds) this._control.disconnect(id);
        this._controlIds = [];
        this._control = null;
        this._onState = null;
    }
}
