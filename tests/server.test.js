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
            request.on('error', reject);
            request.end();
        });
    }
    const page = await request();
    assert.equal(page.status, 200);
    assert.match(page.body, /Touchpad/);
    assert.match(page.headers['content-security-policy'], new RegExp(tls ? 'wss:' : 'ws:'));
    for (const module of ['keyboard', 'touchpad', 'editing']) {
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
    async function connect(origin, token) {
        const request = transport.request(`${url.origin}/control?token=${token}`, {...requestOptions, headers: {
            Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Key': randomBytes(16).toString('base64'), Origin: origin,
        }});
        const result = new Promise((resolve, reject) => {
            request.on('upgrade', (_response, socket, head) => resolve({socket, head}));
            request.on('response', response => {response.resume(); resolve({status: response.statusCode});});
            request.on('error', reject);
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
    assert.equal((await connect('https://example.org', url.hash.slice(1))).status, 403);
    const bad = await connect(url.origin, 'wrong');
    const badFrame = bad.head.length ? bad.head : (await once(bad.socket, 'data'))[0];
    assert.equal(badFrame[0] & 0x0f, 8);
    bad.socket.destroy();
    assert.equal(events.some(event => event.state === 'pending'), false);

    const {socket} = await connect(url.origin, url.hash.slice(1));
    socket.on('data', () => {});
    t.after(() => socket.destroy());
    send(socket, {type: 'click', button: 1});
    await waitFor(() => events.some(event => event.state === 'connected'));
    assert.equal(events.some(event => event.input), false);
    send(socket, {type: 'move', dx: 10, dy: -5});
    await waitFor(() => events.some(event => event.input));
    assert.deepEqual(events.find(event => event.input).input, {type: 'move', dx: 10, dy: -5});
    send(socket, {type: 'key', key: 'Super'});
    await waitFor(() => events.some(event => event.state === 'disconnected'));
    socket.destroy();
    const replay = await connect(url.origin, url.hash.slice(1));
    const replayFrame = replay.head.length ? replay.head : (await once(replay.socket, 'data'))[0];
    assert.equal(replayFrame[0] & 0x0f, 8);
    replay.socket.destroy();
    assert.equal(events.filter(event => event.state === 'pending').length, 1);
 });
}
