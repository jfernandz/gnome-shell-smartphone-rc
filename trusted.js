import GLib from 'gi://GLib';

export const TRUST_SECONDS = 90 * 24 * 60 * 60;
const nowSeconds = () => Math.floor(GLib.get_real_time() / 1000000);

export class TrustedBrowsers {
    constructor(settings, now = nowSeconds) {
        this._settings = settings;
        this._now = now;
    }

    list() {
        try {
            const records = JSON.parse(this._settings.get_string('trusted-browsers'));
            if (!Array.isArray(records))
                return [];
            return records.filter(record => record && /^[a-f0-9]{64}$/.test(record.id) &&
                typeof record.name === 'string' && record.name.length <= 80 &&
                Number.isSafeInteger(record.created) && Number.isSafeInteger(record.lastUsed) &&
                Number.isSafeInteger(record.expires) && record.expires > record.created).slice(0, 32);
        } catch {
            return [];
        }
    }

    _save(records) {
        if (!this._settings.set_string('trusted-browsers', JSON.stringify(records)))
            throw new Error('Could not save trusted browsers.');
    }

    _id(secret) {
        if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret))
            return null;
        return GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, secret, -1);
    }

    find(secret) {
        const id = this._id(secret);
        return this.list().find(record => record.id === id && record.expires > this._now()) ?? null;
    }

    contains(id) {
        return this.list().some(record => record.id === id && record.expires > this._now());
    }

    remember(secret, name = 'My phone') {
        const id = this._id(secret);
        if (!id)
            throw new Error('Invalid browser credential.');
        const records = this.list().filter(record => record.expires > this._now() && record.id !== id);
        if (records.length >= 32)
            throw new Error('Forget a trusted browser before adding another (maximum 32).');
        const record = {id, name: name.trim().slice(0, 80) || 'My phone',
            created: this._now(), lastUsed: this._now(), expires: this._now() + TRUST_SECONDS};
        this._save([...records, record]);
        return record;
    }

    touch(id) {
        const records = this.list();
        const record = records.find(item => item.id === id);
        if (record && this._now() - record.lastUsed >= 60) {
            record.lastUsed = this._now();
            this._save(records);
        }
    }

    rename(id, name) {
        const records = this.list();
        const record = records.find(item => item.id === id);
        if (record) {
            record.name = name.trim().slice(0, 80) || 'My phone';
            this._save(records);
        }
    }

    forget(id) {
        this._save(this.list().filter(record => record.id !== id));
    }

    forgetAll() {
        this._save([]);
    }
}
