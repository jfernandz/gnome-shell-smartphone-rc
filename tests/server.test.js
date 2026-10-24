import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import test from 'node:test';

test('real GJS server enforces origin, pairing, approval, validation and token revocation', {timeout: 10000}, async t => {
    const child = spawn('gjs', ['-m', 'tests/server-fixture.js']);
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
    const page = await fetch(url.origin);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Touchpad/);
    assert.equal((await fetch(`${url.origin}/missing`)).status, 404);
    assert.equal((await fetch(url.origin, {method: 'POST'})).status, 403);

    // Node's browser-compatible WebSocket cannot set Origin; use its HTTP upgrade transport below.
    const {default: http} = await import('node:http');
    const {randomBytes} = await import('node:crypto');
    async function connect(origin, token) {
        const request = http.request(`${url.origin}/control?token=${token}`, {headers: {
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
