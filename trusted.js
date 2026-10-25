import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {trustDurationDays} from './settings.js';

export const TRUST_SECONDS = 90 * 24 * 60 * 60;
const nowSeconds = () => Math.floor(GLib.get_real_time() / 1000000);

function browserSettingsFactory() {
    const schemaId = 'org.gnome.shell.extensions.smartphone-rc.browser';
    const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_child('schemas');
    let source = Gio.SettingsSchemaSource.get_default();
    if (directory.get_child('gschemas.compiled').query_exists(null))
        source = Gio.SettingsSchemaSource.new_from_directory(directory.get_path(), source, false);
    const schema = source.lookup(schemaId, true);
    if (!schema)
        throw new Error('Trusted-browser settings schema is missing. Reinstall the extension.');
    return id => new Gio.Settings({settings_schema: schema,
        path: `/org/gnome/shell/extensions/smartphone-rc/browsers/${id}/`});
}

export class TrustedBrowsers {
    constructor(settings, now = nowSeconds, createBrowserSettings = null) {
        this._settings = settings;
        this._now = now;
        this._createBrowserSettings = createBrowserSettings;
        this._browsers = new Map();
    }

    _browser(id) {
        if (!this._browsers.has(id)) {
            this._createBrowserSettings ??= browserSettingsFactory();
            this._browsers.set(id, this._createBrowserSettings(id));
        }
        return this._browsers.get(id);
    }

    _grants() {
        try {
            const records = JSON.parse(this._settings.get_string('trusted-browsers'));
            if (!Array.isArray(records))
                return [];
            return records.filter(record => record && /^[a-f0-9]{64}$/.test(record.id) &&
                typeof record.name === 'string' && record.name.length <= 80 &&
                Number.isSafeInteger(record.created) && Number.isSafeInteger(record.lastUsed) &&
                Number.isSafeInteger(record.expires) && record.expires > record.created &&
                (record.generation === undefined || typeof record.generation === 'string')).slice(0, 32);
        } catch {
            return [];
        }
    }

    _isCurrent(record, generation) {
        return record && (record.generation ?? '') === generation && !this._browser(record.id).get_boolean('revoked');
    }

    _withMetadata(record) {
        const settings = this._browser(record.id);
        return {...record, name: settings.get_string('name') || record.name,
            lastUsed: Math.max(record.lastUsed, settings.get_int64('last-used'))};
    }

    _grant(id) {
        const record = this._grants().find(item => item.id === id);
        return this._isCurrent(record, this._settings.get_string('trust-generation')) ? record : null;
    }

    list() {
        const generation = this._settings.get_string('trust-generation');
        return this._grants().filter(record => this._isCurrent(record, generation)).map(record => this._withMetadata(record));
    }

    get(id) {
        const record = this._grant(id);
        return record ? this._withMetadata(record) : null;
    }

    watch(onChange) {
        const children = new Map();
        const sync = () => {
            const ids = new Set(this._grants().map(record => record.id));
            for (const [id, signal] of children) {
                if (!ids.has(id)) {
                    this._browser(id).disconnect(signal);
                    children.delete(id);
                }
            }
            for (const id of ids) {
                if (!children.has(id))
                    children.set(id, this._browser(id).connect('changed', () => onChange()));
            }
        };
        const grantsId = this._settings.connect('changed::trusted-browsers', () => { sync(); onChange(); });
        const generationId = this._settings.connect('changed::trust-generation', () => onChange());
        sync();
        return () => {
            this._settings.disconnect(grantsId);
            this._settings.disconnect(generationId);
            for (const [id, signal] of children)
                this._browser(id).disconnect(signal);
            children.clear();
        };
    }

    _id(secret) {
        if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret))
            return null;
        return GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, secret, -1);
    }

    find(secret) {
        const record = this.get(this._id(secret));
        return record && record.expires > this._now() ? record : null;
    }

    contains(id) {
        const record = this._grant(id);
        return Boolean(record && record.expires > this._now());
    }

    remember(secret, name = 'My phone') {
        const id = this._id(secret);
        if (!id || this._browser(id).get_boolean('revoked'))
            throw new Error('A new credential is required to remember this browser.');
        const generation = this._settings.get_string('trust-generation');
        const records = this.list().filter(record => record.expires > this._now() && record.id !== id);
        if (records.length >= 32)
            throw new Error('Forget a trusted browser before adding another (maximum 32).');
        const record = {id, name: name.trim().slice(0, 80) || 'My phone', generation,
            created: this._now(), lastUsed: this._now(), expires: this._now() + trustDurationDays(this._settings) * 24 * 60 * 60};
        // Only enrollment writes grants. Metadata never rewrites authorization or revocation.
        if (!this._settings.set_string('trusted-browsers', JSON.stringify([...records, record])))
            throw new Error('Could not save trusted browsers.');
        return record;
    }

    touch(id) {
        const record = this.get(id);
        if (record && this._now() - record.lastUsed >= 60 && !this._browser(id).set_int64('last-used', this._now()))
            throw new Error('Could not update browser usage.');
    }

    rename(id, name) {
        if (this._grant(id) && !this._browser(id).set_string('name', name.trim().slice(0, 80) || 'My phone'))
            throw new Error('Could not rename the browser.');
    }

    forget(id) {
        if (/^[a-f0-9]{64}$/.test(id) && !this._browser(id).set_boolean('revoked', true))
            throw new Error('Could not revoke browser trust.');
    }

    forgetAll() {
        // A stale enrollment or metadata write cannot restore a previous generation.
        if (!this._settings.set_string('trust-generation', GLib.uuid_string_random()))
            throw new Error('Could not revoke browser trust.');
    }
}
