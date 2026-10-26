import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import https from 'node:https';
import net from 'node:net';

// Optional bounded soak; loopback TLS and a disposable helper, never desktop input.
const seconds = Number(process.env.SMARTPHONE_RC_SOAK_SECONDS ?? 30);
assert.ok(Number.isInteger(seconds) && seconds >= 10 && seconds <= 300);
const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-soak-'));
const events = [];
const samples = [];
const sockets = new Set();
let child;
let errors = '';
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitFor(check) {
    for (let attempt = 0; attempt < 400; attempt++) {
        if (check()) return;
        assert.ok(child.exitCode === null && child.signalCode === null, errors || 'Fixture exited');
        await delay(25);
    }
    throw Error(`Fixture condition timed out: ${errors}`);
}
try {
    execFileSync('bash', ['scripts/lib/stage.sh', `${directory}/runtime`]);
    execFileSync('openssl', ['req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
        '-nodes', '-days', '1', '-subj', '/CN=Loopback Soak', '-addext', 'subjectAltName=IP:127.0.0.1',
        '-keyout', `${directory}/key.pem`, '-out', `${directory}/cert.pem`], {stdio: 'ignore'});
    const ca = readFileSync(`${directory}/cert.pem`);
    child = spawn('gjs', ['-m', 'tests/service-fixture.js', `${directory}/runtime`, '127.0.0.1', `${directory}/cert.pem`, `${directory}/key.pem`],
        {env: {...process.env, GSETTINGS_BACKEND: 'memory', XDG_CONFIG_HOME: `${directory}/config`, TMPDIR: directory}});
    child.stderr.on('data', data => errors += data);
    createInterface({input: child.stdout}).on('line', line => events.push(JSON.parse(line)));
    await waitFor(() => events.some(event => event.url || event.failure));
    assert.equal(events.find(event => event.failure), undefined);
    const info = events.find(event => event.url);
    const url = new URL(info.url);
    function sample() {
        const status = readFileSync(`/proc/${info.pid}/status`, 'utf8');
        samples.push({rssKiB: Number(/VmRSS:\s+(\d+)/.exec(status)[1]), fds: readdirSync(`/proc/${info.pid}/fd`).length});
    }
    function request() {
        return new Promise(resolve => {
            const req = https.get(url.origin, {ca, agent: false, timeout: 1500}, response => {
                response.resume(); response.on('end', () => resolve(response.statusCode));
            });
            req.on('timeout', () => req.destroy());
            req.on('error', () => resolve(null));
        });
    }
    assert.equal(await request(), 200);
    sample();
    let requests = 0;
    let served = 0;
    let slowConnections = 0;
    const start = Date.now();
    while (Date.now() - start < seconds * 1000) {
        // Repeated incomplete TLS handshakes compete with real HTTPS requests.
        for (let i = 0; i < 20; i++) {
            const socket = net.connect({host: url.hostname, port: Number(url.port)});
            sockets.add(socket); slowConnections++;
            socket.on('error', () => {});
            socket.on('close', () => sockets.delete(socket));
            socket.setTimeout(6000, () => socket.destroy());
        }
        const results = await Promise.all(Array.from({length: 8}, () => request()));
        requests += results.length;
        served += results.filter(status => status === 200).length;
        assert.equal(events.some(event => event.failure || event.input), false);
        sample();
        assert.ok(samples.at(-1).fds <= 128);
        await delay(500);
    }
    for (const socket of sockets) socket.destroy();
    // Allow production handshake/idle deadlines and rate budgets to recover.
    await delay(16000);
    assert.equal(await request(), 200, 'Service must recover after overload ends');
    sample();
    assert.ok(samples.at(-1).fds <= samples[0].fds + 8, 'Connections must release descriptors');
    const growthKiB = samples.at(-1).rssKiB - samples[0].rssKiB;
    assert.ok(growthKiB < 64 * 1024, 'Retained RSS growth must stay below 64 MiB for this bounded run');
    assert.equal(events.some(event => event.failure || event.input), false);
    assert.equal(errors, '');
    console.log(JSON.stringify({seconds, requests, served, slowConnections, samples: samples.length,
        peakRssKiB: Math.max(...samples.map(sample => sample.rssKiB)), growthKiB,
        peakFds: Math.max(...samples.map(sample => sample.fds)), finalFds: samples.at(-1).fds, baselineFds: samples[0].fds}));
} finally {
    for (const socket of sockets) socket.destroy();
    if (child && child.exitCode === null && child.signalCode === null) {
        const done = once(child, 'exit'); child.kill('SIGTERM'); await done;
    }
    rmSync(directory, {recursive: true, force: true});
}
