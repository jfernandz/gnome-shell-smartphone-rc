import GLib from 'gi://GLib';
import {AUTO_STOP} from './settings.js';

export function formatRemaining(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const suffix = `${String(minutes % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    return minutes >= 60 ? `${Math.floor(minutes / 60)}:${suffix}` : suffix;
}

export class AutoStopTimer {
    constructor(onExpire, onTick, environment = GLib) {
        this._environment = environment;
        this._onExpire = onExpire;
        this._onTick = onTick;
        this._deadline = null;
        this._source = 0;
        this._generation = 0;
    }

    get remainingSeconds() {
        return this._deadline === null ? null : Math.max(0, this._deadline - this._environment.get_monotonic_time() / 1_000_000);
    }

    start(minutes) {
        if (!Number.isInteger(minutes) || minutes < AUTO_STOP.min || minutes > AUTO_STOP.max)
            return false;
        this.cancel();
        this._deadline = this._environment.get_monotonic_time() / 1_000_000 + minutes * 60;
        const generation = this._generation;
        this._onTick(this.remainingSeconds);
        this._source = this._environment.timeout_add_seconds(this._environment.PRIORITY_DEFAULT, 1, () => {
            if (generation !== this._generation)
                return this._environment.SOURCE_REMOVE;
            const remaining = this.remainingSeconds;
            if (remaining <= 0) {
                this._source = 0;
                this._expire();
                return this._environment.SOURCE_REMOVE;
            }
            this._onTick(remaining);
            return this._environment.SOURCE_CONTINUE;
        });
        return true;
    }

    extend(minutes) {
        const remaining = this.remainingSeconds;
        if (remaining === null)
            return false;
        if (remaining <= 0) {
            this._expire();
            return false;
        }
        if (!Number.isInteger(minutes) || minutes < AUTO_STOP.min || remaining + minutes * 60 > AUTO_STOP.max * 60)
            return false;
        this._deadline += minutes * 60;
        this._onTick(this.remainingSeconds);
        return true;
    }

    cancel() {
        this._generation++;
        if (this._source)
            this._environment.Source.remove(this._source);
        this._source = 0;
        this._deadline = null;
        this._onTick(null);
    }

    _expire() {
        this.cancel();
        this._onExpire();
    }

    destroy() {
        this.cancel();
        this._onExpire = this._onTick = () => {};
    }
}
