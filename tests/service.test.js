import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn, execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';

async function start(t) {
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-service-'));
    execFileSync('bash', ['scripts/lib/stage.sh', directory]);
    const child = spawn('gjs', ['-m', 'tests/service-fixture.js', directory], {env: {...process.env, GSETTINGS_BACKEND: 'memory'}});
    const events = [];
    let errors = '';
    child.stderr.on('data', data => errors += data);
    createInterface({input: child.stdout}).on('line', line => events.push(JSON.parse(line)));
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            const done = once(child, 'exit'); child.kill('SIGTERM'); await done;
        }
        rmSync(directory, {recursive: true, force: true});
        assert.equal(errors, '');
    });
    const wait = async predicate => {
        for (let i = 0; i < 300; i++) {
            if (predicate()) return;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.fail(`Helper condition timed out: ${errors}`);
    };
    await wait(() => events.some(event => event.url));
    const info = events.find(event => event.url);
    return {child, events, wait, ...info};
}

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url.split('/#')[0], {agent: false}, response => {
            response.resume(); response.on('end', () => resolve(response.statusCode));
        }).on('error', reject);
    });
}

test('network service runs in a bounded child process and a crash fails closed', {timeout: 10000}, async t => {
    const fixture = await start(t);
    assert.notEqual(fixture.pid, fixture.child.pid);
    const limits = readFileSync(`/proc/${fixture.pid}/limits`, 'utf8');
    assert.match(limits, /Max open files\s+128\s+128/);
    assert.match(limits, /Max core file size\s+0\s+0/);
    assert.match(limits, /Max data size\s+536870912\s+536870912/);
    assert.equal(await get(fixture.url), 200);
    fixture.child.kill('SIGWINCH');
    await fixture.wait(() => fixture.events.some(event => event.failure));
    await assert.rejects(get(fixture.url), /ECONNREFUSED|ECONNRESET/);
});

test('network service exits when its parent disappears and closes its listener', {timeout: 10000}, async t => {
    const fixture = await start(t);
    assert.equal(await get(fixture.url), 200);
    const stopped = once(fixture.child, 'exit');
    fixture.child.kill('SIGKILL');
    await stopped;
    await fixture.wait(() => {
        try { return readFileSync(`/proc/${fixture.pid}/stat`, 'utf8').split(' ')[2] === 'Z'; }
        catch { return true; }
    });
    await assert.rejects(get(fixture.url), /ECONNREFUSED|ECONNRESET/);
});

test('occupied port fails safely through the real helper and permits retry', {timeout: 10000}, async t => {
    const {createServer} = await import('node:net');
    const listener = createServer();
    await new Promise((resolve, reject) => {
        listener.once('error', reject);
        listener.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise(resolve => listener.close(resolve)));
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-port-busy-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    execFileSync('bash', ['scripts/lib/stage.sh', directory]);
    const output = execFileSync('gjs', ['-m', 'tests/service-startup-failure-fixture.js', directory,
        String(listener.address().port)], {encoding: 'utf8', timeout: 8000, env: {...process.env, GSETTINGS_BACKEND: 'memory'}});
    assert.match(output, /^PASS: occupied port/);
});
