import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, X509Certificate} from 'node:crypto';
import {createInterface} from 'node:readline';
import {once} from 'node:events';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-cookie-browser-'));
const children = [];
const debuggers = [];
const events = [];
async function waitFor(check) {
    for (let i = 0; i < 300; i++) {
        const value = await check();
        if (value) return value;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Browser check timed out');
}
async function debuggerConnection(url) {
    const socket = new WebSocket(url);
    await once(socket, 'open');
    debuggers.push(socket);
    let id = 0;
    const waiting = new Map();
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        const request = waiting.get(message.id);
        if (!request) return;
        waiting.delete(message.id);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
    });
    return (method, params = {}) => new Promise((resolve, reject) => {
        const request = ++id;
        waiting.set(request, {resolve, reject});
        socket.send(JSON.stringify({id: request, method, params}));
    });
}
try {
    execFileSync('openssl', ['req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
        '-nodes', '-days', '1', '-subj', '/CN=Smartphone RC Cookie Test', '-addext', 'subjectAltName=IP:127.0.0.1',
        '-keyout', `${directory}/key.pem`, '-out', `${directory}/cert.pem`], {stdio: 'ignore'});
    const certificate = new X509Certificate(readFileSync(`${directory}/cert.pem`));
    const spki = certificate.publicKey.export({type: 'spki', format: 'der'});
    const pin = createHash('sha256').update(spki).digest('base64');
    const server = spawn('gjs', ['-m', 'tests/server-fixture.js', '127.0.0.1', `${directory}/cert.pem`, `${directory}/key.pem`], {
        cwd: root, env: {...process.env, SMARTPHONE_RC_TEST_SESSION_SECONDS: '1800'}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(server);
    createInterface({input: server.stdout}).on('line', line => events.push(JSON.parse(line)));
    const pairing = await waitFor(() => events.find(event => event.url)?.url);
    const origin = new URL(pairing).origin;
    let browser;
    let control;
    let debugOrigin;
    async function launchBrowser() {
        let browserUrl;
        browser = spawn(process.env.SMARTPHONE_RC_CHROMIUM_BIN ?? 'chromium', [
            '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            `--ignore-certificate-errors-spki-list=${pin}`, `--user-data-dir=${directory}/profile`,
            '--remote-debugging-port=0', 'about:blank',
        ], {stdio: ['ignore', 'ignore', 'pipe']});
        children.push(browser);
        browser.stderr.on('data', data => {
            const match = data.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) browserUrl = match[1];
        });
        await waitFor(() => browserUrl);
        control = await debuggerConnection(browserUrl);
        debugOrigin = browserUrl.replace(/^ws:/, 'http:').split('/devtools/')[0];
    }
    await launchBrowser();
    async function tab(url) {
        const {targetId} = await control('Target.createTarget', {url});
        const info = await waitFor(async () => (await (await fetch(`${debugOrigin}/json/list`)).json()).find(page => page.id === targetId));
        const call = await debuggerConnection(info.webSocketDebuggerUrl);
        async function evaluate(expression) {
            const result = await call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true, userGesture: true});
            if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
            return result.result.value;
        }
        await waitFor(() => evaluate('document.readyState === "complete" && !!document.querySelector("#connect")'));
        return {targetId, call, evaluate};
    }
    const first = await tab(pairing);
    await first.evaluate('document.querySelector("#connect").click()');
    await waitFor(() => first.evaluate('document.querySelector("#status").textContent === "Connected"'));
    const cookies = await waitFor(async () => (await first.call('Network.getCookies', {urls: [origin]})).cookies.find(cookie => cookie.name === '__Host-smartphone_rc'));
    assert.equal(cookies.httpOnly, true);
    assert.equal(cookies.secure, true);
    assert.equal(cookies.sameSite, 'Strict');
    assert.equal(cookies.path, '/');
    assert.ok(cookies.expires - Date.now() / 1000 > 1700);
    assert.equal(await first.evaluate('document.cookie'), '');
    assert.equal(await first.evaluate('sessionStorage.getItem("resumeToken")'), null);
    await control('Target.closeTarget', {targetId: first.targetId});
    const reopened = await tab(`${origin}/`);
    await waitFor(() => reopened.evaluate('document.querySelector("#status").textContent === "Connected"'));
    assert.equal(events.filter(event => event.state === 'pending').length, 1);
    console.log('PASS: Secure/HttpOnly/Strict cookie restores control in a fresh Chrome tab without another approval');
    const exited = once(browser, 'exit');
    browser.kill('SIGTERM');
    await exited;
    await launchBrowser();
    const restarted = await tab(`${origin}/`);
    await waitFor(() => restarted.evaluate('document.querySelector("#status").textContent === "Connected"'));
    assert.equal(events.filter(event => event.state === 'pending').length, 1);
    console.log('PASS: restarting Chromium with its saved profile restores the approved session');
    await restarted.evaluate('document.querySelector("#disconnect").click()');
    await waitFor(() => restarted.evaluate('document.querySelector("#status").textContent.startsWith("Disconnected")'));
    const revoked = await tab(`${origin}/`);
    await waitFor(() => revoked.evaluate('fetch("/session").then(response=>response.json()).then(state=>!state.authenticated)'));
    assert.equal(await revoked.evaluate('document.querySelector("#connect").disabled'), true);
    assert.equal((await revoked.call('Network.getCookies', {urls: [origin]})).cookies.some(cookie => cookie.name === '__Host-smartphone_rc'), false);
    console.log('PASS: explicit disconnect revokes the cookie and prevents recovery in a new tab');
} finally {
    for (const socket of debuggers) socket.close();
    for (const child of children.reverse()) {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGTERM');
            await once(child, 'exit');
        }
    }
    rmSync(directory, {recursive: true, force: true});
}
