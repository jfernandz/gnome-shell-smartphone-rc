import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import http from 'node:http';
import net from 'node:net';

async function fixture(t, extra = {}) {
    const child = spawn('gjs', ['-m', 'tests/server-fixture.js'], {env: {...process.env, ...extra}});
    const events = [];
    let errors = '';
    child.stderr.on('data', data => errors += data);
    createInterface({input: child.stdout}).on('line', line => events.push(JSON.parse(line)));
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) { const done = once(child, 'exit'); child.kill('SIGTERM'); await done; }
        assert.equal(errors, '');
    });
    const wait = async check => {
        for (let i = 0; i < 200; i++) {
            if (check()) return;
            if (child.exitCode !== null || child.signalCode !== null) throw Error(errors || 'Server exited unexpectedly');
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.fail(`Security check timed out: ${errors}`);
    };
    await wait(() => events.some(event => event.url));
    return {url: new URL(events.find(event => event.url).url), events, wait};
}

async function upgrade(url) {
    const request = http.request(`${url.origin}/control`, {headers: {Origin: url.origin,
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64')}});
    const ready = once(request, 'upgrade');
    request.end();
    const [, socket, head] = await ready;
    return {socket, head};
}

function frame(opcode, final, body) {
    const mask = randomBytes(4);
    const header = Buffer.alloc(body.length < 126 ? 2 : 4);
    header[0] = (final ? 128 : 0) | opcode;
    header[1] = 128 | (body.length < 126 ? body.length : 126);
    if (header.length === 4) header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, mask, Buffer.from(body.map((value, index) => value ^ mask[index % 4]))]);
}

async function closeCode(socket, head) {
    const data = head.length ? head : await Promise.race([once(socket, 'data').then(([data]) => data),
        new Promise(resolve => socket.once('close', () => resolve(null)))]);
    if (data === null) return null;
    assert.equal(data[0] & 15, 8);
    return data.readUInt16BE(2);
}

test('HTTP bodies are rejected before 100-continue and pairing credentials are rejected in URLs', {timeout: 5000}, async t => {
    const {url} = await fixture(t);
    let continued = false;
    const status = await new Promise((resolve, reject) => {
        const request = http.request(`${url.origin}/session`, {method: 'POST', headers: {
            Origin: url.origin, Expect: '100-continue', 'Content-Length': 1048576,
        }}, response => { response.resume(); response.on('end', () => { request.destroy(); resolve(response.statusCode); }); });
        request.on('continue', () => { continued = true; request.destroy(); reject(Error('Server accepted body upload')); });
        request.on('error', reject);
        request.flushHeaders();
    });
    assert.equal(status, 413);
    assert.equal(continued, false);
    const query = await new Promise((resolve, reject) => {
        http.get(`${url.origin}/control?token=secret`, response => {
            response.resume(); response.on('end', () => resolve(response.statusCode));
        }).on('error', reject);
    });
    assert.equal(query, 403);
    const headerStatus = await new Promise((resolve, reject) => {
        http.get(url.origin, {headers: {'X-Oversized': 'a'.repeat(9000)}}, response => {
            response.resume(); response.on('end', () => resolve(response.statusCode));
        }).on('error', reject);
    });
    assert.equal(headerStatus, 431);
});

test('fragmented WebSocket messages have a total size bound before authentication', {timeout: 5000}, async t => {
    const {url, events} = await fixture(t);
    const {socket, head} = await upgrade(url);
    t.after(() => socket.destroy());
    const closed = closeCode(socket, head);
    socket.write(Buffer.concat([frame(1, false, Buffer.alloc(1024, 65)), frame(0, false, Buffer.alloc(1024, 65)),
        frame(0, true, Buffer.alloc(1024, 65))]));
    assert.ok([1009, null].includes(await closed), 'Oversized messages must close before authentication');
    assert.equal(events.some(event => event.state === 'pending'), false);
});

test('unauthenticated sockets expire and slow headers cannot exhaust the connection budget', {timeout: 5000}, async t => {
    const {url} = await fixture(t, {SMARTPHONE_RC_TEST_AUTH_MS: '100',
        SMARTPHONE_RC_TEST_NETWORK_LIMITS: JSON.stringify({maxConnections: 3, maxPeerConnections: 2, requestSeconds: 0.3})});
    const ws = await upgrade(url);
    t.after(() => ws.socket.destroy());
    assert.equal(await closeCode(ws.socket, ws.head), 1008);
    ws.socket.destroy();
    await new Promise(resolve => setTimeout(resolve, 300));
    const sockets = [];
    t.after(() => sockets.forEach(socket => socket.destroy()));
    for (let i = 0; i < 2; i++) {
        const socket = net.connect(Number(url.port), '127.0.0.1');
        sockets.push(socket);
        await once(socket, 'connect');
        socket.write('GET / HTTP/1.1\r\n');
    }
    const extra = net.connect(Number(url.port), '127.0.0.1');
    sockets.push(extra);
    await once(extra, 'connect');
    await once(extra, 'end');
    await Promise.all(sockets.slice(0, 2).map(socket => socket.destroyed ? Promise.resolve() : once(socket, 'close')));
    const response = await new Promise((resolve, reject) => {
        http.get(url.origin, result => { result.resume(); result.on('end', () => resolve(result.statusCode)); }).on('error', reject);
    });
    assert.equal(response, 200);
});
