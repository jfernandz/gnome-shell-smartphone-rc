import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../session-actions.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export class', 'class');
const SessionActions = vm.runInNewContext(`(() => {${source}; return SessionActions;})()`, {});
function fixture({available = 'yes', inhibitors = [], application = false, locks = true, canLock = true, invoke} = {}) {
    const events = [];
    const errors = [];
    let locked = false;
    const actions = new SessionActions({
        stop: () => { events.push('stop'); actions.cancel(); },
        canLock: () => canLock,
        lock: () => { events.push('lock'); locked = locks; actions.destroy(); },
        isLocked: () => locked,
        notify: error => errors.push(error),
        cancellable: () => ({cancelled: false, cancel() { this.cancelled = true; }, is_cancelled() { return this.cancelled; }}),
        invoke: async (bus, method, signature, args, cancellable) => {
            events.push({bus, method, signature, args: Array.from(args)});
            if (invoke) return invoke(method, cancellable);
            if (method === 'CanSuspend') return [available];
            if (method === 'ListInhibitors') return [inhibitors];
            if (method === 'IsInhibited') return [application];
            if (method === 'SuspendWithFlags') return [];
            throw Error('Unexpected method');
        },
    });
    return {actions, events, errors};
}

test('lock stops input before locking, without power calls or restart', async () => {
    const f = fixture();
    assert.equal(await f.actions.request('lock'), true);
    assert.deepEqual(f.events, ['stop', 'lock']);
    assert.deepEqual(f.errors, []);
    assert.equal(await f.actions.request('lock'), false);
});

test('suspend checks availability and inhibitors, locks, then requests inhibitor-respecting sleep', async () => {
    const f = fixture();
    assert.equal(await f.actions.request('suspend'), true);
    assert.deepEqual(f.events.map(event => typeof event === 'string' ? event : event.method),
        ['stop', 'CanSuspend', 'ListInhibitors', 'IsInhibited', 'lock', 'SuspendWithFlags']);
    assert.deepEqual(f.events.at(-1), {bus: 'system', method: 'SuspendWithFlags', signature: '(t)', args: [1]});
    assert.deepEqual(f.errors, []);
});

test('unsupported or unauthorized suspension stays stopped and never locks or sleeps', async () => {
    for (const available of ['no', 'na', 'challenge', 'inhibited', 'challenge-inhibitor-blocked', 'unknown']) {
        const f = fixture({available});
        assert.equal(await f.actions.request('suspend'), false);
        assert.equal(f.errors.length, 1);
        assert.ok(!f.events.includes('lock'));
        assert.ok(!f.events.some(event => event.method === 'SuspendWithFlags'));
    }
});

test('system and GNOME application inhibitors are honored, including weak and combined inhibitors', async () => {
    for (const options of [{application: true}, {inhibitors: [['sleep', 'app', 'busy', 'block', 1000, 1]]},
        {inhibitors: [['idle:sleep', 'app', 'busy', 'block-weak', 1000, 1]]}]) {
        const f = fixture(options);
        assert.equal(await f.actions.request('suspend'), false);
        assert.ok(!f.events.includes('lock'));
        assert.equal(f.errors.length, 1);
    }
    assert.equal(await fixture({inhibitors: [['sleep', 'app', 'save', 'delay', 1000, 1]]}).actions.request('suspend'), true);
});

test('lock failure or lockdown never requests sleep and does not restart control', async () => {
    for (const options of [{canLock: false}, {locks: false}]) {
        const f = fixture(options);
        assert.equal(await f.actions.request('suspend'), false);
        assert.equal(f.errors.length, 1);
        assert.ok(!f.events.some(event => event.method === 'SuspendWithFlags'));
        assert.equal(f.events[0], 'stop');
    }
});

test('bus failures and last-moment inhibitor rejection report failure while staying stopped', async () => {
    for (const failed of ['CanSuspend', 'ListInhibitors', 'IsInhibited', 'SuspendWithFlags']) {
        const f = fixture({invoke: async method => {
            if (method === failed) throw Error('Denied');
            return {CanSuspend: ['yes'], ListInhibitors: [[]], IsInhibited: [false]}[method];
        }});
        assert.equal(await f.actions.request('suspend'), false);
        assert.deepEqual(f.errors, ['Denied']);
        assert.equal(f.events[0], 'stop');
    }
});

test('local Stop/disable cancels preflight; stale results cannot lock a later session', async () => {
    let resolve;
    const f = fixture({invoke: method => method === 'CanSuspend' ? new Promise(done => resolve = done) :
        Promise.resolve(method === 'ListInhibitors' ? [[]] : [false])});
    const pending = f.actions.request('suspend');
    assert.equal(await f.actions.request('suspend'), false);
    f.actions.cancel();
    resolve(['yes']);
    assert.equal(await pending, false);
    assert.ok(!f.events.includes('lock'));
    assert.deepEqual(f.errors, []);
});
