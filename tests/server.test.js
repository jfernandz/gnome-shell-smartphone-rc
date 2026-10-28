import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import https from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import test from 'node:test';

for (const tls of [false, true]) {
 test(`real GJS server (${tls ? 'TLS' : 'local HTTP'}) enforces host, origin, pairing, approval and revocation`, {timeout: 10000}, async t => {
    let certificate;
    const args = ['-m', 'tests/server-fixture.js'];
    if (tls) {
        const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-tls-'));
        t.after(() => rmSync(directory, {recursive: true, force: true}));
        execFileSync('openssl', ['req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
            '-nodes', '-days', '1', '-subj', '/CN=Smartphone RC Test', '-addext', 'subjectAltName=IP:127.0.0.1',
            '-keyout', `${directory}/key.pem`, '-out', `${directory}/cert.pem`], {stdio: 'ignore'});
        certificate = readFileSync(`${directory}/cert.pem`);
        args.push('127.0.0.1', `${directory}/cert.pem`, `${directory}/key.pem`);
    }
    const child = spawn('gjs', args);
    const events = [];
    let errors = '';
    child.stderr.on('data', data => errors += data);
    createInterface({input: child.stdout}).on('line', line => events.push(JSON.parse(line)));
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGTERM');
            await once(child, 'exit');
        }
        assert.equal(errors, '');
    });
    const waitFor = async predicate => {
        for (let i = 0; i < 150; i++) {
            if (predicate()) return;
            assert.equal(child.exitCode, null, `Server exited: ${errors}`);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.fail(`Condition timed out. Server stderr: ${errors}`);
    };
    await waitFor(() => events.some(event => event.url));
    const url = new URL(events.find(event => event.url).url);
    const {default: http} = await import('node:http');
    const transport = tls ? https : http;
    const requestOptions = tls ? {ca: certificate, checkServerIdentity: (_host, cert) => checkServerIdentity('127.0.0.1', cert)} : {};
    async function request(path = '/', options = {}) {
        return await new Promise((resolve, reject) => {
            const request = transport.request(`${url.origin}${path}`, {...requestOptions, ...options}, response => {
                let body = '';
                response.on('data', data => body += data);
                response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body}));
            });
            request.on('error', error => { error.message += ` (${options.method ?? 'GET'} ${path})`; reject(error); });
            request.end();
        });
    }
    const page = await request();
    assert.equal(page.status, 200);
    assert.match(page.body, /Touchpad/);
    assert.match(page.headers['content-security-policy'], new RegExp(tls ? 'wss:' : 'ws:'));
    for (const module of ['keyboard', 'touchpad', 'editing', 'viewport']) {
        const asset = await request(`/${module}.js`);
        assert.equal(asset.status, 200);
        assert.match(asset.headers['content-type'], /^text\/javascript/);
        assert.match(asset.body, /export function/);
    }
    assert.equal((await request('/missing')).status, 404);
    assert.equal((await request('/', {method: 'POST'})).status, 403);
    assert.equal((await request('/', {headers: {Host: 'attacker.example'}})).status, 403);
    if (tls) {
        await assert.rejects(new Promise((resolve, reject) => {
            https.get(url.origin, resolve).on('error', reject);
        }), /self-signed/);
    }

    // Node's browser-compatible WebSocket cannot set Origin; use its HTTP upgrade transport below.
    const {randomBytes} = await import('node:crypto');
    async function connect(origin, token = null, cookie = null, requestOrigin = origin) {
        const request = transport.request(`${origin}/control`, {...requestOptions, headers: {
            Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Key': randomBytes(16).toString('base64'), Origin: requestOrigin,
            ...(cookie ? {Cookie: cookie} : {}),
        }});
        const result = new Promise((resolve, reject) => {
            request.on('upgrade', (_response, socket, head) => {
                if (token) send(socket, {type: 'authenticate', token});
                resolve({socket, head});
            });
            request.on('response', response => {response.resume(); resolve({status: response.statusCode});});
            request.on('error', error => { error.message += ` (WebSocket ${token ? 'pairing' : 'cookie'} ${requestOrigin})`; reject(error); });
        });
        request.end();
        return result;
    }
    function send(socket, value) {
        const payload = Buffer.from(JSON.stringify(value));
        const mask = randomBytes(4);
        assert.ok(payload.length < 126);
        const masked = Buffer.from(payload.map((byte, i) => byte ^ mask[i % 4]));
        socket.write(Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]));
    }
    assert.equal((await connect(url.origin, url.hash.slice(1), null, 'https://example.org')).status, 403);
    const bad = await connect(url.origin, 'wrong');
    const badFrame = bad.head.length ? bad.head : (await once(bad.socket, 'data'))[0];
    assert.equal(badFrame[0] & 0x0f, 8);
    bad.socket.destroy();
    assert.equal(events.some(event => event.state === 'pending'), false);

    function observe(socket, head) {
        const messages = [];
        let buffer = Buffer.alloc(0);
        function receive(data) {
            buffer = Buffer.concat([buffer, data]);
            while (buffer.length >= 2) {
                let length = buffer[1] & 127;
                let offset = 2;
                if (length === 126) {
                    if (buffer.length < 4) return;
                    length = buffer.readUInt16BE(2);
                    offset = 4;
                }
                if (buffer.length < offset + length) return;
                if ((buffer[0] & 15) === 1)
                    messages.push(JSON.parse(buffer.subarray(offset, offset + length).toString()));
                buffer = buffer.subarray(offset + length);
            }
        }
        socket.on('data', receive);
        receive(head);
        return messages;
    }
    async function deniedCookie(cookie) {
        const result = await connect(url.origin, null, cookie);
        send(result.socket, {type: 'authenticate', token: 'invalid'});
        const frame = result.head.length ? result.head : (await once(result.socket, 'data'))[0];
        assert.equal(frame[0] & 15, 8);
        result.socket.destroy();
    }
    async function remember(packets) {
        await waitFor(() => packets.some(packet => packet.type === 'approved'));
        const approved = packets.find(packet => packet.type === 'approved');
        assert.equal(approved.exchangeToken.length, 64);
        assert.equal(approved.resumeToken, undefined);
        const headers = {Origin: url.origin, Authorization: `Bearer ${approved.exchangeToken}`};
        const response = await request('/session', {method: 'POST', headers});
        assert.equal(response.status, 200);
        assert.equal(JSON.parse(response.body).authenticated, true);
        const cookie = response.headers['set-cookie'][0];
        for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'])
            assert.ok(cookie.includes(flag), cookie);
        assert.match(cookie, /^__Host-smartphone_rc=[a-f0-9]{64};/);
        assert.doesNotMatch(cookie, /Domain=/i);
        assert.equal((await request('/session', {method: 'POST', headers})).status, 403, 'exchange is one-use');
        return cookie.split(';')[0];
    }
    assert.equal(JSON.parse((await request('/session')).body).authenticated, false);
    assert.equal((await request('/session', {method: 'POST', headers: {Origin: url.origin}})).status, 403);
    let {socket, head} = await connect(url.origin, url.hash.slice(1));
    let packets = observe(socket, head);
    t.after(() => socket.destroy());
    send(socket, {type: 'session-action', action: 'lock'});
    send(socket, {type: 'click', button: 1});
    send(socket, {type: 'volume', output: 7, level: 90});
    const cookie = await remember(packets);
    assert.equal(events.some(event => event.input), false);
    assert.equal(JSON.parse((await request('/session', {headers: {Cookie: cookie}})).body).authenticated, true);
    assert.equal((await request('/session', {method: 'POST', headers: {Cookie: cookie, Origin: 'https://example.org'}})).status, 403);
    send(socket, {type: 'move', dx: 10, dy: -5});
    await waitFor(() => events.some(event => event.input));
    assert.deepEqual(events.find(event => event.input).input, {type: 'move', dx: 10, dy: -5});
    send(socket, {type: 'suspend'});
    await waitFor(() => events.some(event => event.state === 'suspended'));
    send(socket, {type: 'session-action', action: 'suspend'});
    send(socket, {type: 'move', dx: 333, dy: 0});
    send(socket, {type: 'mute', output: 7, muted: true});
    send(socket, {type: 'resume'});
    await waitFor(() => events.filter(event => event.state === 'connected').length >= 2);
    assert.equal(events.filter(event => event.input).length, 1);
    send(socket, {type: 'volume', output: 7, level: 60});
    send(socket, {type: 'mute', output: 7, muted: false});
    await waitFor(() => events.filter(event => event.input).length === 3);
    assert.deepEqual(events.filter(event => event.input).slice(1).map(event => event.input), [
        {type: 'volume', output: 7, level: 60}, {type: 'mute', output: 7, muted: false},
    ]);
    socket.destroy();
    await waitFor(() => events.some(event => event.state === 'reconnecting'));
    ({socket, head} = await connect(url.origin, null, cookie));
    packets = observe(socket, head);
    await waitFor(() => packets.some(packet => packet.type === 'approved'));
    assert.equal(events.filter(event => event.state === 'pending').length, 1, 'cookie recovery needs no new approval');
    send(socket, {type: 'disconnect'});
    await waitFor(() => events.some(event => event.state === 'disconnected'));
    socket.destroy();
    await deniedCookie(cookie);
    const revoked = await request('/session', {headers: {Cookie: cookie}});
    assert.equal(JSON.parse(revoked.body).authenticated, false);
    assert.match(revoked.headers['set-cookie'][0], /Max-Age=0/);

    async function freshSession() {
        const count = events.filter(event => event.url).length;
        child.kill('SIGUSR1');
        await waitFor(() => events.filter(event => event.url).length > count);
        const fresh = new URL(events.filter(event => event.url).at(-1).url);
        const connection = await connect(fresh.origin, fresh.hash.slice(1));
        const messages = observe(connection.socket, connection.head);
        return {socket: connection.socket, cookie: await remember(messages)};
    }
    const invalid = await freshSession();
    send(invalid.socket, {type: 'key', key: 'Super'});
    await waitFor(() => events.filter(event => event.state === 'disconnected').length >= 2);
    invalid.socket.destroy();
    await deniedCookie(invalid.cookie);
    const stopped = await freshSession();
    const replacement = await freshSession();
    stopped.socket.destroy();
    await deniedCookie(stopped.cookie);
    const expiryCount = events.filter(event => event.state === 'expired').length;
    // Actual input extends the server-side idle deadline.
    for (let i = 0; i < 7; i++) {
        send(replacement.socket, {type: 'move', dx: 1, dy: 0});
        await new Promise(resolve => setTimeout(resolve, 350));
        assert.equal(JSON.parse((await request('/session', {headers: {Cookie: replacement.cookie}})).body).authenticated, true);
    }
    // Cookie refreshes must not count as user activity or defeat the idle limit.
    for (let i = 0; i < 3; i++) {
        const refreshed = await request('/session', {method: 'POST', headers: {Cookie: replacement.cookie, Origin: url.origin}});
        assert.equal(refreshed.status, 200);
        await new Promise(resolve => setTimeout(resolve, 350));
    }
    await waitFor(() => events.filter(event => event.state === 'expired').length > expiryCount);
    replacement.socket.destroy();
    await deniedCookie(replacement.cookie);
    for (const action of ['lock', 'suspend']) {
        const terminal = await freshSession();
        const count = events.filter(event => event.input).length;
        send(terminal.socket, {type: 'session-action', action});
        send(terminal.socket, {type: 'move', dx: 44, dy: 0});
        send(terminal.socket, {type: 'resume'});
        send(terminal.socket, {type: 'session-action', action});
        await waitFor(() => events.filter(event => event.input).length > count);
        await new Promise(resolve => setTimeout(resolve, 60));
        assert.deepEqual(events.filter(event => event.input).slice(count).map(event => event.input), [{type: 'session-action', action}]);
        terminal.socket.destroy();
    }

 });
}
