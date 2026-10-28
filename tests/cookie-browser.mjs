import assert from 'node:assert/strict';
import {checkBrowserAccessibility} from './browser-accessibility.mjs';
import {spawn, execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, mkdirSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, X509Certificate, randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline';
import {once} from 'node:events';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-cookie-browser-'));
const otherCredential = randomBytes(32).toString('hex');
const trustedMode = process.argv.includes('--trusted');
const helperMode = process.argv.includes('--helper');
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
    if (helperMode)
        execFileSync('bash', ['scripts/lib/stage.sh', `${directory}/runtime`], {cwd: root});
    if (trustedMode) {
        mkdirSync(`${directory}/schemas`);
        for (const name of ['org.gnome.shell.extensions.smartphone-rc', 'org.gnome.shell.extensions.smartphone-rc.browser'])
            copyFileSync(`${root}/schemas/${name}.gschema.xml`, `${directory}/schemas/${name}.gschema.xml`);
        execFileSync('glib-compile-schemas', ['--strict', `${directory}/schemas`]);
    }
    function startServer(port = 0) {
        const child = spawn('gjs', ['-m', ...(helperMode ? ['tests/service-fixture.js', `${directory}/runtime`] : ['tests/server-fixture.js']), '127.0.0.1', `${directory}/cert.pem`, `${directory}/key.pem`], {
        cwd: root, env: {...process.env, SMARTPHONE_RC_TEST_SESSION_SECONDS: '1800',
            SMARTPHONE_RC_TEST_PORT: String(port),
            ...(trustedMode ? {SMARTPHONE_RC_TEST_TRUST: '1', SMARTPHONE_RC_TEST_OTHER_CREDENTIAL: otherCredential, GSETTINGS_SCHEMA_DIR: `${directory}/schemas`,
                GSETTINGS_BACKEND: 'keyfile', XDG_CONFIG_HOME: `${directory}/config`} : {})}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    createInterface({input: child.stdout}).on('line', line => events.push(JSON.parse(line)));
    child.stderr.on('data', data => process.stderr.write(data));
    return child;
    }
    let server = startServer();
    const pairing = await waitFor(() => {
        const failure = events.find(event => event.failure);
        if (failure) throw new Error(failure.failure);
        return events.find(event => event.url)?.url;
    });
    const origin = new URL(pairing).origin;
    let browser;
    let control;
    let debugOrigin;
    async function launchBrowser() {
        let browserUrl;
        let startupError = null;
        let startupStderr = '';
        browser = spawn(process.env.SMARTPHONE_RC_CHROMIUM_BIN ?? 'chromium', [
            '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            `--ignore-certificate-errors-spki-list=${pin}`, `--user-data-dir=${directory}/profile`,
            '--remote-debugging-port=0', 'about:blank',
        ], {stdio: ['ignore', 'ignore', 'pipe']});
        children.push(browser);
        browser.once('error', error => startupError = error);
        browser.once('exit', (code, signal) => {
            startupError = new Error(`Chromium exited before debugging connected (code=${code}, signal=${signal}).`);
        });
        browser.stderr.on('data', data => {
            startupStderr = (startupStderr + data.toString()).slice(-16384);
            const match = data.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) browserUrl = match[1];
        });
        try {
            await waitFor(() => {
                if (startupError) throw startupError;
                return browserUrl;
            });
        } catch (error) {
            throw new Error(`Chromium startup failed: ${error.message}\n${startupStderr}`, {cause: error});
        }
        control = await debuggerConnection(browserUrl);
        debugOrigin = browserUrl.replace(/^ws:/, 'http:').split('/devtools/')[0];
    }
    await launchBrowser();
    async function tab(url, browserContextId = undefined) {
        const {targetId} = await control('Target.createTarget', {url, browserContextId});
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
    await waitFor(() => first.evaluate('!document.querySelector("#volume").disabled'));
    assert.equal(await first.evaluate('document.querySelector("#volume").value'), '40');
    await first.evaluate(`(() => {
        const slider = document.querySelector('#volume');
        slider.value = '65';
        slider.dispatchEvent(new Event('input', {bubbles: true}));
        document.querySelector('#mute').click();
    })()`);
    await waitFor(() => events.some(event => event.input?.type === 'volume' && event.input.level === 65 && event.input.output === 7));
    await waitFor(() => events.some(event => event.input?.type === 'mute' && event.input.muted === true));
    console.log('PASS: desktop volume snapshot reaches Chromium and validated volume/mute commands return through the authenticated service');
    if (process.argv.includes('--accessibility'))
        await checkBrowserAccessibility(first, process.env.SMARTPHONE_RC_ACCESSIBILITY_OUTPUT);
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
    await control('Browser.close');
    await exited;
    await launchBrowser();
    let restarted = await tab(`${origin}/`);
    await waitFor(() => restarted.evaluate('document.querySelector("#status").textContent === "Connected"')).catch(async error => {
        console.error('Resources:', await restarted.evaluate('performance.getEntriesByType("resource").map(r=>({name:r.name,status:r.responseStatus,bytes:r.transferSize}))'));
        console.error('Restart status:', await restarted.evaluate('document.querySelector("#status").textContent'));
        console.error('Cookies:', (await restarted.call('Network.getCookies', {urls: [origin]})).cookies.map(cookie => cookie.name));
        console.error('States:', events.filter(event => event.state));
        throw error;
    });
    assert.equal(events.filter(event => event.state === 'pending').length, 1);
    console.log('PASS: restarting Chromium with its saved profile restores the approved session');
    await control('Target.closeTarget', {targetId: restarted.targetId});
    restarted = await tab(pairing);
    await restarted.evaluate('document.querySelector("#connect").click()');
    await waitFor(() => restarted.evaluate('document.querySelector("#status").textContent === "Connected"'));
    assert.equal(events.filter(event => event.state === 'pending').length, 1);
    console.log('PASS: reopening a scanned link with a valid cookie preserves the authorized session');
    if (trustedMode) {
        const trustCookie = (await restarted.call('Network.getCookies', {urls: [origin]})).cookies
            .find(cookie => cookie.name === '__Host-smartphone_rc_trust');
        assert.ok(trustCookie);
        assert.equal(trustCookie.httpOnly, true);
        assert.equal(trustCookie.secure, true);
        assert.equal(trustCookie.sameSite, 'Strict');
        const days = Number(process.env.SMARTPHONE_RC_TEST_TRUST_DAYS ?? 90);
        assert.ok(trustCookie.expires - Date.now() / 1000 > (days - 1) * 86400);
        assert.ok(trustCookie.expires - Date.now() / 1000 <= days * 86400 + 5);
        const {browserContextId} = await control('Target.createBrowserContext');
        const stranger = await tab(`${origin}/`, browserContextId);
        assert.equal(await stranger.evaluate('document.querySelector("#connect").disabled'), true);
        await stranger.call('Network.setCookie', {name: '__Host-smartphone_rc_trust', value: otherCredential,
            url: origin, secure: true, httpOnly: true, sameSite: 'Strict', path: '/'});
        assert.equal(await stranger.evaluate('fetch("/session").then(r=>r.json()).then(s=>s.authenticated)'), true);
        assert.equal(await stranger.evaluate('fetch("/session",{method:"POST"}).then(r=>r.status)'), 403);
        const busy = await stranger.evaluate(`new Promise(resolve => {
            const ws = new WebSocket(${JSON.stringify(origin.replace('https:', 'wss:') + '/control')});
            ws.onclose = event => resolve(event.code);
        })`);
        assert.equal(busy, 1008);
        assert.equal(await restarted.evaluate('document.querySelector("#status").textContent'), 'Connected');
        await control('Target.disposeBrowserContext', {browserContextId});
        console.log('PASS: a different trusted browser cannot take over an active connection or obtain its session cookie');
        await control('Target.closeTarget', {targetId: restarted.targetId});
        const stopped = once(server, 'exit');
        server.kill('SIGTERM');
        await stopped;
        const priorUrls = events.filter(event => event.url).length;
        server = startServer(Number(new URL(origin).port));
        await waitFor(() => events.filter(event => event.url).length > priorUrls);
        const recovered = await tab(`${origin}/`);
        await waitFor(() => recovered.evaluate('document.querySelector("#status").textContent === "Connected"'));
        assert.equal(events.filter(event => event.state === 'pending').length, 1);
        console.log('PASS: remembered browser survives a complete service process restart without pairing');
        await recovered.evaluate('document.querySelector("#disconnect").click()');
        await waitFor(() => recovered.evaluate('document.querySelector("#status").textContent.startsWith("Disconnected")'));
        await waitFor(() => recovered.evaluate('!document.querySelector("#connect").disabled'));
        assert.equal(await recovered.evaluate('document.querySelector("#status").textContent'), 'Disconnected. Tap Connect to reconnect.');
        await recovered.evaluate('document.querySelector("#connect").click()');
        const connectedAgain = recovered;
        await waitFor(() => connectedAgain.evaluate('document.querySelector("#status").textContent === "Connected"'));
        console.log('PASS: Disconnect enables Connect and reconnects the same page without refreshing');
        server.kill('SIGUSR2');
        await waitFor(() => connectedAgain.evaluate('document.querySelector("#status").textContent.startsWith("Disconnected")'));
        await control('Target.closeTarget', {targetId: connectedAgain.targetId});
        const forgotten = await tab(`${origin}/`);
        await waitFor(() => forgotten.evaluate('fetch("/session").then(response=>response.json()).then(state=>!state.authenticated)'));
        assert.equal(await forgotten.evaluate('document.querySelector("#connect").disabled'), true);
        assert.equal((await forgotten.call('Network.getCookies', {urls: [origin]})).cookies
            .some(cookie => cookie.name === '__Host-smartphone_rc_trust'), false);
        console.log('PASS: Forget revokes active control and rejects the saved trust cookie');
        await control('Target.closeTarget', {targetId: forgotten.targetId});
        const oldInvitations = events.filter(event => event.url).length;
        server.kill('SIGUSR1');
        await waitFor(() => events.filter(event => event.url).length > oldInvitations);
        const newInvitation = events.filter(event => event.url).at(-1).url;
        const pairedAgain = await tab(newInvitation);
        await pairedAgain.evaluate('document.querySelector("#connect").click()');
        await waitFor(() => pairedAgain.evaluate('document.querySelector("#status").textContent === "Connected"'));
        await waitFor(async () => (await pairedAgain.call('Network.getCookies', {urls: [origin]})).cookies
            .some(cookie => cookie.name === '__Host-smartphone_rc_trust'));
        server.kill('SIGHUP');
        await waitFor(() => pairedAgain.evaluate('document.querySelector("#status").textContent.startsWith("Disconnected")'));
        await waitFor(() => pairedAgain.evaluate('fetch("/session").then(r=>r.json()).then(s=>!s.authenticated)'));
        assert.equal(await pairedAgain.evaluate('document.querySelector("#connect").disabled'), true);
        console.log('PASS: individual revocation is observed through per-browser settings and disconnects active control');
    } else {
    await restarted.evaluate('document.querySelector("#disconnect").click()');
    await waitFor(() => restarted.evaluate('document.querySelector("#status").textContent.startsWith("Disconnected")'));
    const revoked = await tab(`${origin}/`);
    await waitFor(() => revoked.evaluate('fetch("/session").then(response=>response.json()).then(state=>!state.authenticated)'));
    assert.equal(await revoked.evaluate('document.querySelector("#connect").disabled'), true);
    assert.equal((await revoked.call('Network.getCookies', {urls: [origin]})).cookies.some(cookie => cookie.name === '__Host-smartphone_rc'), false);
    console.log('PASS: explicit disconnect revokes the cookie and prevents recovery in a new tab');
    }
    // The helper fixture logs actions; it never imports Shell session actions or
    // calls the system power/lock APIs. Exercise both confirmations end to end.
    for (const action of ['lock', 'suspend']) {
        const invitations = events.filter(event => event.url).length;
        server.kill('SIGUSR1');
        await waitFor(() => events.filter(event => event.url).length > invitations);
        const terminal = await tab(events.filter(event => event.url).at(-1).url);
        await terminal.evaluate('document.querySelector("#connect").click()');
        await waitFor(() => terminal.evaluate('document.querySelector("#status").textContent === "Connected"'));
        await terminal.evaluate(`window.confirm = () => true; document.querySelector('#${action}-pc').click()`);
        await waitFor(() => events.some(event => event.input?.type === 'session-action' && event.input.action === action));
        assert.equal(await terminal.evaluate('document.querySelector("#connect").disabled && document.querySelector("#lock-pc").disabled && document.querySelector("#suspend-pc").disabled'), true);
        assert.match(await terminal.evaluate('document.querySelector("#status").textContent'), /locally on the PC/);
        await control('Target.closeTarget', {targetId: terminal.targetId});
    }
    console.log('PASS: confirmed lock/suspend requests traverse Chromium and the authenticated helper without executing host power actions');
} finally {
    for (const socket of debuggers) socket.close();
    for (const child of children.reverse()) {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGTERM');
            await once(child, 'exit');
        }
    }
    rmSync(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
}
