import {TrustedBrowsers, TRUST_SECONDS} from '../trusted.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
function memorySettings(defaults) {
    const values = new Map(Object.entries(defaults));
    const handlers = new Map();
    let next = 0;
    return {
        get_string: key => values.get(key) ?? '',
        get_boolean: key => values.get(key) ?? false,
        get_int64: key => values.get(key) ?? 0,
        set_string(key, value) { return this.write(key, value); },
        set_boolean(key, value) { return this.write(key, value); },
        set_int64(key, value) { return this.write(key, value); },
        write(key, value) {
            values.set(key, value);
            for (const [signal, callback] of [...handlers.values()]) {
                if (signal === 'changed' || signal === `changed::${key}`)
                    callback(this, key);
            }
            return true;
        },
        connect(signal, callback) { handlers.set(++next, [signal, callback]); return next; },
        disconnect(id) { handlers.delete(id); },
    };
}
let now = 1000000000;
const settings = memorySettings({'trusted-browsers': '[]', 'trust-generation': ''});
const devices = new Map();
const deviceSettings = id => {
    if (!devices.has(id)) devices.set(id, memorySettings({}));
    return devices.get(id);
};
const createStore = () => new TrustedBrowsers(settings, () => now, deviceSettings);
const store = createStore();
const secret = 'ab'.repeat(32);
const first = store.remember(secret, '  My phone  ');
assert(first.name === 'My phone', 'Names are trimmed');
assert(!settings.get_string('trusted-browsers').includes(secret), 'Only a verifier is stored');
assert(store.find(secret)?.id === first.id, 'Valid credentials authenticate');
assert(!store.find('invalid') && !store.find('cd'.repeat(32)), 'Unknown credentials fail');
store.rename(first.id, 'Work phone');
assert(store.list()[0].name === 'Work phone', 'Names can be changed');
now += 61;
store.touch(first.id);
assert(store.list()[0].lastUsed === now, 'Last use updates');
assert(createStore().find(secret), 'A new store instance reads persisted trust');
now = first.created + TRUST_SECONDS;
assert(!store.find(secret) && !store.contains(first.id), 'Expiry rejects credentials');
now = first.created;
store.forget(first.id);
assert(!store.find(secret), 'Individual revocation rejects credentials');
const next = store.remember('cd'.repeat(32));
store.forgetAll();
assert(store.list().length === 0, 'Global revocation removes all entries');
settings.set_string('trusted-browsers', '{invalid json');
assert(store.list().length === 0, 'Malformed storage fails closed');
settings.set_string('trusted-browsers', JSON.stringify([{...first, expires: 'forever'}, {id: 'invalid'}]));
assert(store.list().length === 0, 'Malformed records fail closed');

// Legacy grants remain valid without rewriting their authorization or credential.
settings.set_string('trust-generation', '');
settings.set_string('trusted-browsers', JSON.stringify([{...next, generation: undefined}]));
assert(store.find('cd'.repeat(32)), 'Legacy records keep their authorization');
const preferences = createStore();
const metadata = deviceSettings(next.id);
const writeLastUsed = metadata.set_int64;
metadata.set_int64 = function (key, value) {
    preferences.forget(next.id);
    return writeLastUsed.call(this, key, value);
};
now += 61;
store.touch(next.id);
assert(!store.find('cd'.repeat(32)), 'A metadata write overlapping Forget cannot restore trust');
const staleGrants = settings.get_string('trusted-browsers');
settings.set_string('trusted-browsers', staleGrants);
assert(!store.find('cd'.repeat(32)), 'Even a stale grant snapshot cannot undo individual revocation');
const third = store.remember('ef'.repeat(32));
const oldGeneration = settings.get_string('trusted-browsers');
preferences.forgetAll();
settings.set_string('trusted-browsers', oldGeneration);
assert(!store.contains(third.id), 'Stale enrollment cannot undo Forget all');
const fourth = store.remember('12'.repeat(32));
assert(store.contains(fourth.id), 'A fresh enrollment works after Forget all');
let changes = 0;
const unwatch = store.watch(() => changes++);
preferences.rename(fourth.id, 'Changed');
preferences.forget(fourth.id);
assert(changes === 2, 'Watch observes metadata and individual revocation');
unwatch();
preferences.forgetAll();
assert(changes === 2, 'Watch cleanup disconnects all settings signals');
print('Trusted browser validation, persistence, expiry, revocation and concurrent metadata checks passed');
