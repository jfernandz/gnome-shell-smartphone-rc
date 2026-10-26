import GLib from 'gi://GLib';

const EXCHANGE_LIFETIME_US = 30 * 1000000;
const MICROSECONDS_PER_SECOND = 1000000;
const MICROSECONDS_PER_MILLISECOND = 1000;

// Own temporary credentials and expiry; HTTP, sockets and enrollment stay in the server.
export class SessionAuthorization {
    constructor(trusted, sessionSeconds, newSecret, onExpired) {
        this._trusted = trusted;
        this.sessionSeconds = sessionSeconds;
        this._newSecret = newSecret;
        this._onExpired = onExpired;
        this.sessionSecret = null;
        this.sessionExpiry = 0;
        this.exchangeToken = null;
        this.trustedId = null;
    }

    issueExchange() {
        this.exchangeToken = this._newSecret();
        this.exchangeDeadline = GLib.get_monotonic_time() + EXCHANGE_LIFETIME_US;
        return this.exchangeToken;
    }

    hasSession(secret) {
        return Boolean(this.sessionSecret && secret === this.sessionSecret && this.active());
    }

    validExchange(authorization) {
        return Boolean(this.exchangeToken && this.active() &&
            GLib.get_monotonic_time() < this.exchangeDeadline && authorization === `Bearer ${this.exchangeToken}`);
    }

    consumeExchange(approved) {
        this.exchangeToken = null;
        if (!this.sessionSecret) {
            this.sessionSecret = this._newSecret();
            this.touch(approved);
        }
    }

    get cookieAgeSeconds() {
        return Math.max(1, Math.ceil((this.sessionDeadline - GLib.get_monotonic_time()) / MICROSECONDS_PER_SECOND));
    }

    active() {
        return GLib.get_monotonic_time() < this.sessionDeadline &&
            (!this.trustedId || this._trusted.contains(this.trustedId));
    }

    touch(approved) {
        this.sessionDeadline = GLib.get_monotonic_time() + this.sessionSeconds * MICROSECONDS_PER_SECOND;
        if (this.trustedId)
            this._trusted.touch(this.trustedId);
        if ((this.sessionSecret || approved) && !this.sessionExpiry)
            this._armExpiry();
    }

    _armExpiry() {
        const remaining = Math.max(1, Math.ceil((this.sessionDeadline - GLib.get_monotonic_time()) / MICROSECONDS_PER_MILLISECOND));
        this.sessionExpiry = GLib.timeout_add(GLib.PRIORITY_DEFAULT, remaining, () => {
            this.sessionExpiry = 0;
            if (GLib.get_monotonic_time() >= this.sessionDeadline) {
                this._onExpired();
            } else {
                this._armExpiry();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    clear() {
        if (this.sessionExpiry) {
            GLib.Source.remove(this.sessionExpiry);
            this.sessionExpiry = 0;
        }
        this.sessionSecret = null;
        this.exchangeToken = null;
        this.trustedId = null;
        this.rememberRequested = false;
    }
}
