import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function fixture() {
    const timers = new Map();
    let id = 0;
    let secret = 0;
    let closed = 0;
    const context = vm.createContext({GLib: {
        PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false,
        get_monotonic_time: () => 0,
        timeout_add_seconds(_priority, seconds, callback) {
            assert.equal(seconds, 120);
            timers.set(++id, callback);
            return id;
        },
        Source: {remove(key) { assert.ok(timers.delete(key)); }},
    }});
    const source = readFileSync(new URL('../app/server.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '').replaceAll('export ', '');
    const Server = vm.runInContext(`${source}; RemoteServer`, context);
    const server = Object.create(Server.prototype);
    Object.assign(server, {_server: {}, _origin: 'https://192.168.1.2:8844', _client: null,
        _unauthenticated: new Map(), _newSecret: () => String(++secret).padStart(64, '0'),
        _onPairingClosed: () => closed++, _authorization: {clear() {}},
    });
    return {server, timers, closed: () => closed, expire() {
        const [key, callback] = [...timers][0];
        timers.delete(key);
        callback();
    }};
}

test('local pairing windows rotate invitations, close after 120 seconds and cannot open on stopped services', () => {
    const f = fixture();
    const first = f.server.openPairing();
    assert.match(first, /\/#.{64}$/);
    assert.notEqual(f.server.openPairing(), first);
    assert.equal(f.timers.size, 1);
    f.expire();
    assert.equal(f.server._token, null);
    assert.equal(f.closed(), 2);
    assert.equal(f.timers.size, 0);
    f.server._server = null;
    assert.equal(f.server.openPairing(), null);
});

test('closing pairing drops unauthenticated sockets and pending approval, preserving approved control', () => {
    const f = fixture();
    f.server.openPairing();
    let socketClosed = false;
    f.timers.set(99, () => {});
    f.server._unauthenticated.set({disconnect() {}, close(code) {
        assert.equal(code, 1008);
        socketClosed = true;
    }}, {timer: 99, message: 1, closed: 2});
    f.server._client = {};
    f.server._approved = false;
    let disconnected = 0;
    f.server.disconnect = () => { disconnected++; };
    f.server.closePairing();
    assert.equal(disconnected, 1);
    assert.equal(socketClosed, true);
    assert.equal(f.server._unauthenticated.size, 0);
    assert.equal(f.timers.size, 0);
    f.server._approved = true;
    f.server.closePairing();
    assert.equal(disconnected, 1);
    assert.equal(f.server.openPairing(), null);
    f.server._client = null;
    f.server._terminalAction = true;
    assert.equal(f.server.openPairing(), null);
});

test('approval consumes the invitation and cancels its expiry before authorizing control', () => {
    const f = fixture();
    f.server.openPairing();
    f.server._client = {};
    let remember;
    f.server._authorization.requestRemember = value => { remember = value; };
    f.server._authorize = () => {
        assert.equal(f.server._token, null);
        assert.equal(f.timers.size, 0);
    };
    f.server.approve(true);
    assert.equal(remember, true);
    assert.equal(f.closed(), 1);
});
