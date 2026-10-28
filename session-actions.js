import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

function call(bus, method, signature, args, cancellable) {
    const system = bus === 'system';
    const name = system ? 'org.freedesktop.login1' : 'org.gnome.SessionManager';
    const path = system ? '/org/freedesktop/login1' : '/org/gnome/SessionManager';
    const iface = system ? 'org.freedesktop.login1.Manager' : name;
    return new Promise((resolve, reject) => {
        Gio.DBus[bus].call(name, path, iface, method, new GLib.Variant(signature, args), null,
            Gio.DBusCallFlags.NO_AUTO_START, 10000, cancellable, (connection, result) => {
                try { resolve(connection.call_finish(result).deep_unpack()); } catch (error) { reject(error); }
            });
    });
}

export class SessionActions {
    constructor({stop, canLock, lock, isLocked, notify, invoke = call, cancellable = () => new Gio.Cancellable()}) {
        this._stop = stop;
        this._canLock = canLock;
        this._lock = lock;
        this._isLocked = isLocked;
        this._notify = notify;
        this._call = invoke;
        this._cancellable = cancellable;
        this._pending = null;
        this._destroyed = false;
    }

    async request(action) {
        if (this._destroyed || !['lock', 'suspend'].includes(action) || this._pending)
            return false;
        // Revoke remote input before checks or lock. Stop may cancel an older job.
        this._stop();
        const cancellable = this._cancellable();
        this._pending = cancellable;
        try {
            if (!this._canLock())
                throw Error('Screen locking is unavailable. Remote control remains stopped.');
            if (action === 'suspend') {
                const [available] = await this._call('system', 'CanSuspend', '()', [], cancellable);
                if (available !== 'yes')
                    throw Error('Suspension is unavailable or requires local authorization. Remote control remains stopped.');
                const [inhibitors] = await this._call('system', 'ListInhibitors', '()', [], cancellable);
                if (!Array.isArray(inhibitors) || inhibitors.some(([what, , , mode]) =>
                    what.split(':').includes('sleep') && ['block', 'block-weak'].includes(mode)))
                    throw Error('Suspension is inhibited. Remote control remains stopped.');
                const [inhibited] = await this._call('session', 'IsInhibited', '(u)', [4], cancellable);
                if (inhibited !== false)
                    throw Error('An application inhibits suspension. Remote control remains stopped.');
            }
            if (this._pending !== cancellable || cancellable.is_cancelled())
                return false;
            if (!this._canLock())
                throw Error('Screen locking is no longer available. Remote control remains stopped.');
            // Lock disables the extension. No pending preflight survives that point;
            // only this already committed, bounded system request may finish.
            this._pending = null;
            this._lock();
            if (!this._isLocked())
                throw Error('The desktop could not be securely locked. Suspension was not requested.');
            if (action === 'suspend') {
                // Enforce block and block-weak inhibitors, including races after
                // preflight. Never set SKIP_INHIBITORS or interactive-auth flags.
                await this._call('system', 'SuspendWithFlags', '(t)', [1], cancellable);
            }
            return true;
        } catch (error) {
            if (!cancellable.is_cancelled())
                this._notify(error.message);
            return false;
        } finally {
            if (this._pending === cancellable)
                this._pending = null;
        }
    }

    cancel() {
        this._pending?.cancel();
        this._pending = null;
    }

    destroy() {
        this._destroyed = true;
        this.cancel();
    }
}
