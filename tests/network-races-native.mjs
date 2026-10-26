import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import {createNetworkGroup} from '../preferences/network.js';
if (!GLib.getenv('SMARTPHONE_RC_NETWORK_TEST')) throw Error('Use the isolated native launcher.');
Adw.init();
const delay = () => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => { resolve(); return GLib.SOURCE_REMOVE; }));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
function assert(value, message) { if (!value) throw Error(message); }
function widgets(root) {
    const result = [root];
    for (let child = root.get_first_child(); child; child = child.get_next_sibling()) result.push(...widgets(child));
    return result;
}
const saved = {address: '192.168.1.2', port: 8844, fingerprint: 'saved', expires: 'later'};
function fixture() {
    const loads = [], discoveries = [], applications = [], published = [];
    const operation = list => (...args) => {
        const pending = deferred(); list.push({...pending, args}); return pending.promise;
    };
    const network = createNetworkGroup((...args) => published.push(args), {
        readConfig: operation(loads), detectAddresses: operation(discoveries), applyConfig: operation(applications),
    });
    const window = new Adw.PreferencesWindow();
    const page = new Adw.PreferencesPage(); window.add(page); page.add(network.group); window.present();
    const all = widgets(window);
    return {
        network, loads, discoveries, applications, published,
        address: all.find(w => w instanceof Adw.EntryRow),
        port: all.find(w => w instanceof Adw.SpinRow),
        choices: all.find(w => w instanceof Adw.ComboRow),
        refresh: all.find(w => w instanceof Gtk.Button && w.label === 'Refresh'),
        apply: all.find(w => w instanceof Gtk.Button && w.label === 'Apply'),
        status: all.find(w => w instanceof Adw.ActionRow && w.title === 'Not configured'),
        close() { network.destroy(); window.close(); },
    };
}
for (const rejectLoad of [false, true]) {
    const f = fixture();
    try {
        f.address.text = saved.address; f.apply.emit('clicked');
        f.applications[0].resolve(saved); await delay();
        if (rejectLoad) f.loads[0].reject(Error('Late startup error'));
        else f.loads[0].resolve({...saved, fingerprint: 'old', port: 1234});
        await delay();
        assert(f.published.length === 1 && f.published[0][0] === saved, 'Late initial load overwrote the applied certificate');
        assert(f.port.value === saved.port && f.status.title.startsWith('Configured:'), 'Late initial load changed the applied form');
    } finally { f.close(); }
}
for (const outcome of ['success', 'empty', 'error']) {
    const f = fixture();
    try {
        f.loads[0].reject(Error('No configuration')); await delay();
        if (!f.discoveries.length) throw Error('Discovery did not start');
        f.address.text = saved.address; f.apply.emit('clicked');
        assert(!f.refresh.sensitive, 'Refresh remains enabled during Apply');
        if (outcome === 'error') f.discoveries[0].reject(Error('Late discovery error'));
        else f.discoveries[0].resolve(outcome === 'empty' ? [] : [{address: '192.168.1.3', name: 'old'}]);
        await delay();
        assert(f.status.title === 'Configuring networking…' && !f.refresh.sensitive, 'Old discovery interfered with Apply');
        f.applications[0].resolve(saved); await delay();
        assert(f.address.text === saved.address && f.refresh.sensitive, 'Apply did not restore the form');
    } finally { f.close(); }
}
{
    const f = fixture();
    try {
        f.loads[0].reject(Error('No configuration')); await delay();
        f.refresh.emit('clicked');
        f.discoveries[1].resolve([{address: '192.168.1.4', name: 'new'}]); await delay();
        f.discoveries[0].reject(Error('Obsolete error')); await delay();
        assert(f.address.text === '192.168.1.4' && f.refresh.sensitive, 'Obsolete discovery changed the latest result');
        assert(f.status.title !== 'Address detection failed', 'Obsolete discovery error became visible');
        f.refresh.emit('clicked'); f.address.text = '';
        f.discoveries[2].resolve([{address: '192.168.1.5', name: 'other'}]); await delay();
        assert(f.address.text === '', 'Discovery replaced an address deliberately cleared by the user');
    } finally { f.close(); }
}
{
    const f = fixture();
    f.close(); f.loads[0].resolve(saved); await delay();
    assert(f.published.length === 0 && f.discoveries.length === 0, 'Closed preferences published a late result');
}
{
    const f = fixture();
    try {
        f.address.text = '192.168.1.99'; f.port.value = 9999;
        f.loads[0].resolve(saved); await delay();
        assert(f.address.text === '192.168.1.99' && f.port.value === 9999, 'Initial load replaced unsaved form edits');
        f.discoveries[0].resolve([{address: '192.168.1.3', name: 'detected'}]); await delay();
        assert(f.address.text === '192.168.1.99', 'Discovery replaced an edited address');
    } finally { f.close(); }
}
{
    const f = fixture();
    f.loads[0].reject(Error('No configuration')); await delay();
    f.apply.emit('clicked');
    const count = f.published.length;
    f.close();
    f.applications[0].resolve(saved);
    f.discoveries[0].reject(Error('Late error after close')); await delay();
    assert(f.published.length === count, 'Closed preferences published a completed Apply');
}
print('PASS: delayed Network load/discovery cannot overwrite Apply, newer results, user edits or closed preferences');
