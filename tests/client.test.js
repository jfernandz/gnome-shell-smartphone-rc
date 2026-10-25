import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '../web/client.js';

function page({hash = '', storage = new Map(), preferences = new Map(), blockedStorage = false, cookieJar = {authenticated: false}} = {}) {
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) {
            elements.set(id, {
                disabled: false, hidden: true, textContent: '', handlers: {}, value: '', selectionStart: 0, selectionEnd: 0,
                classList: {toggle() {}}, blur() { this.focused = false; }, focus() { this.focused = true; },
                setPointerCapture() {},
                setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
                addEventListener(type, callback) { this.handlers[type] = callback; },
            });
        }
        return elements.get(id);
    }
    const sockets = [];
    class Socket {
        static OPEN = 1;
        static CONNECTING = 0;
        constructor(url) {
            this.url = url;
            this.handlers = {};
            this.readyState = 1;
            this.sent = [];
            this.authentication = [];
            sockets.push(this);
        }
        addEventListener(type, callback) { this.handlers[type] = callback; }
        emit(type, event) { this.handlers[type](event); }
        close(code) { this.emit('close', {code}); }
        send(value) {
            const message = JSON.parse(value);
            if (message.type === 'authenticate') { this.authentication.push(message); return; }
            this.sent.push(message);
            if (message.type === 'disconnect')
                cookieJar.authenticated = Boolean(cookieJar.trusted);
        }
    }
    const location = {hash, host: '192.168.1.147:8844', protocol: 'https:'};
    const frames = new Map();
    let nextFrame = 0;
    const documentEvents = new Map();
    const timeouts = new Map();
    const viewportEvents = {};
    const keyboardEvents = {};
    const viewport = {height: 709, offsetTop: 0, addEventListener(type, callback) { viewportEvents[type] = callback; }};
    const keyboardBounds = {y: 0, height: 0, width: 360};
    const viewportStyle = new Map();
    const bodyClasses = new Set();
    const context = {
        visualViewport: viewport, innerHeight: 709, addEventListener() {},
        navigator: {virtualKeyboard: {show() {}, boundingRect: keyboardBounds, addEventListener(type, callback) { keyboardEvents[type] = callback; }}},
        document: {
            getElementById: element, querySelectorAll: () => [], hidden: false,
            addEventListener(type, callback) {
                if (!documentEvents.has(type)) documentEvents.set(type, []);
                documentEvents.get(type).push(callback);
            },
            body: {classList: {add(name) { bodyClasses.add(name); }, remove(name) { bodyClasses.delete(name); }}},
            documentElement: {style: {setProperty(key, value) { viewportStyle.set(key, value); }}},
        },
        location, history: {replaceState() { location.hash = ''; }},
        sessionStorage: {
            getItem(key) { if (blockedStorage) throw new Error('Unavailable'); return storage.get(key) ?? null; },
            setItem(key, value) { if (blockedStorage) throw new Error('Unavailable'); storage.set(key, value); },
            removeItem(key) { if (blockedStorage) throw new Error('Unavailable'); storage.delete(key); },
        },
        localStorage: {
            getItem(key) { if (blockedStorage) throw new Error('Unavailable'); return preferences.get(key) ?? null; },
            setItem(key, value) { if (blockedStorage) throw new Error('Unavailable'); preferences.set(key, value); },
        },
        async fetch(_url, options = {}) {
            if (options.method === 'POST' && options.headers?.Authorization)
                cookieJar.authenticated = true;
            return {ok: options.method !== 'POST' || cookieJar.authenticated, async json() { return {authenticated: cookieJar.authenticated}; }};
        },
        setTimeout(callback) { const id = ++nextFrame; timeouts.set(id, callback); return id; },
        clearTimeout(id) { timeouts.delete(id); },
        WebSocket: Socket,
        requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
        cancelAnimationFrame(id) { frames.delete(id); }, performance: {now: () => 0},
    };
    createClient(context);
    function flushFrames() {
        for (const [id, callback] of [...frames]) {
            frames.delete(id);
            callback();
        }
    }
    return {element, sockets, location, storage, preferences, frames, flushFrames, viewport, viewportEvents, keyboardBounds, keyboardEvents, viewportStyle, bodyClasses, document: context.document, documentEvents, timeouts, cookieJar, settle: () => new Promise(setImmediate)};
}

test('a bare network address guides the user to the QR instead of offering a broken Connect button', () => {
    const browser = page();
    assert.equal(browser.element('connect').disabled, true);
    assert.match(browser.element('status').textContent, /Scan.*QR/);
    browser.element('connect').handlers.click();
    assert.equal(browser.sockets.length, 0);
});

test('a scanned link survives a refresh before connecting and uses encrypted WebSocket transport', () => {
    const storage = new Map();
    const scanned = page({hash: '#secret', storage});
    assert.equal(scanned.location.hash, '#secret');
    assert.equal(scanned.element('connect').disabled, false);
    const refreshed = page({storage});
    refreshed.element('connect').handlers.click();
    assert.equal(refreshed.sockets[0].url, 'wss://192.168.1.147:8844/control');
});

test('approval consumes the scanned secret and disconnection requires scanning a new QR', () => {
    const browser = page({hash: '#secret'});
    browser.element('connect').handlers.click();
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'approved'})});
    assert.equal(browser.storage.has('pairingToken'), false);
    assert.equal(browser.element('status').textContent, 'Connected');
    browser.sockets[0].emit('close');
    assert.equal(browser.element('connect').disabled, true);
    assert.match(browser.element('status').textContent, /scan its QR/);
    assert.equal(page({storage: browser.storage}).element('connect').disabled, true);
});

test('a scanned link works even when the browser refuses session storage', () => {
    const browser = page({hash: '#secret', blockedStorage: true});
    browser.element('connect').handlers.click();
    assert.equal(browser.sockets.length, 1);
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'approved'})});
    assert.equal(browser.element('status').textContent, 'Connected');
});

function connectedPage(options = {}) {
    const browser = page({...options, hash: '#secret'});
    browser.element('connect').handlers.click();
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'approved'})});
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'focus', context: 7, active: true, sensitive: false})});
    return browser;
}

test('desktop text focus opens the editor and typing/corrections stream without Send', () => {
    const browser = connectedPage();
    assert.equal(browser.element('typing').hidden, false);
    assert.equal(browser.element('text').focused, true);
    const input = browser.element('text');
    for (const value of ['helo', 'hello', 'hell']) {
        input.value = value;
        input.handlers.input({isComposing: false});
    }
    assert.deepEqual(browser.sockets[0].sent, [
        {type: 'edit', context: 7, remove: 0, text: 'helo'},
        {type: 'edit', context: 7, remove: 1, text: 'lo'},
        {type: 'edit', context: 7, remove: 1, text: ''},
    ]);
});

test('IME composition commits once and native Enter replaces the toolbar action', () => {
    const browser = connectedPage();
    const input = browser.element('text');
    input.handlers.compositionstart();
    input.value = '日本';
    input.handlers.input({isComposing: true});
    assert.equal(browser.sockets[0].sent.length, 0);
    input.handlers.compositionend();
    input.handlers.input({isComposing: false});
    input.handlers.keydown({key: 'Enter', preventDefault() {}});
    assert.deepEqual(browser.sockets[0].sent, [
        {type: 'edit', context: 7, remove: 0, text: '日本'},
        {type: 'key', context: 7, key: 'Enter'},
    ]);
    assert.equal(input.value, '');
});

test('a changed desktop field clears the local buffer and sensitive input is masked', () => {
    const browser = connectedPage();
    browser.element('text').value = 'old field';
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'focus', context: 8, active: true, sensitive: true})});
    assert.equal(browser.element('text').value, '');
    assert.equal(browser.element('text').type, 'password');
    browser.element('text').value = 'new';
    browser.element('text').handlers.input({isComposing: false});
    assert.equal(browser.sockets[0].sent[0].context, 8);
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'focus', context: 9, active: false})});
    assert.equal(browser.element('typing').hidden, true);
});

test('Backspace on an empty mobile buffer still deletes in the desktop field', () => {
    const browser = connectedPage();
    browser.element('text').handlers.beforeinput({inputType: 'deleteContentBackward', preventDefault() {}});
    assert.deepEqual(browser.sockets[0].sent, [{type: 'edit', context: 7, remove: 1, text: ''}]);
});


test('touchpad movement, tap and two-finger scroll survive module separation', () => {
    const browser = connectedPage();
    const pad = browser.element('touchpad');
    pad.handlers.pointerdown({pointerId: 1, clientX: 10, clientY: 10});
    pad.handlers.pointermove({pointerId: 1, clientX: 50, clientY: 30});
    browser.flushFrames();
    pad.handlers.pointerup({type: 'pointerup', pointerId: 1});
    pad.handlers.pointerdown({pointerId: 1, clientX: 10, clientY: 10});
    pad.handlers.pointerup({type: 'pointerup', pointerId: 1});
    pad.handlers.pointerdown({pointerId: 1, clientX: 10, clientY: 10});
    pad.handlers.pointerdown({pointerId: 2, clientX: 40, clientY: 10});
    pad.handlers.pointermove({pointerId: 1, clientX: 10, clientY: 30});
    browser.flushFrames();
    assert.deepEqual(browser.sockets[0].sent, [
        {type: 'move', dx: 40, dy: 20},
        {type: 'click', button: 1},
        {type: 'scroll', dx: 0, dy: 10},
    ]);
});

test('disconnect cancels pending touchpad movement', () => {
    const browser = connectedPage();
    const pad = browser.element('touchpad');
    pad.handlers.pointerdown({pointerId: 1, clientX: 10, clientY: 10});
    pad.handlers.pointermove({pointerId: 1, clientX: 50, clientY: 30});
    assert.equal(browser.frames.size, 1);
    browser.sockets[0].emit('close');
    assert.equal(browser.frames.size, 0);
    browser.flushFrames();
    assert.deepEqual(browser.sockets[0].sent, []);
});


test('sensitivity scales pointer movement while preserving scroll speed and persists across pages', () => {
    const preferences = new Map();
    const browser = connectedPage({preferences});
    browser.element('sensitivity').value = '2';
    browser.element('sensitivity').handlers.input();
    assert.equal(browser.element('sensitivity-value').textContent, '2.0×');
    const pad = browser.element('touchpad');
    pad.handlers.pointerdown({pointerId: 1, clientX: 10, clientY: 10});
    pad.handlers.pointermove({pointerId: 1, clientX: 30, clientY: 20});
    browser.flushFrames();
    pad.handlers.pointerdown({pointerId: 2, clientX: 60, clientY: 20});
    pad.handlers.pointermove({pointerId: 1, clientX: 30, clientY: 40});
    browser.flushFrames();
    assert.deepEqual(browser.sockets[0].sent, [
        {type: 'move', dx: 40, dy: 20},
        {type: 'scroll', dx: 0, dy: 10},
    ]);
    assert.equal(page({preferences}).element('sensitivity').value, '2');
});

test('sensitivity ignores invalid saved values and works when storage is blocked', () => {
    for (const saved of ['NaN', '0', '50', '-1'])
        assert.equal(page({preferences: new Map([['pointerSensitivity', saved]])}).element('sensitivity').value, '1');
    const browser = page({blockedStorage: true});
    browser.element('sensitivity').value = '0.5';
    browser.element('sensitivity').handlers.input();
    assert.equal(browser.element('sensitivity-value').textContent, '0.5×');
});


test('old fractional sensitivity snaps to a half step and pointer movement stays bounded', () => {
    const browser = connectedPage();
    browser.element('sensitivity').value = '2.85';
    browser.element('sensitivity').handlers.input();
    assert.deepEqual(browser.sockets[0].sent, []);
    const pad = browser.element('touchpad');
    pad.handlers.pointerdown({pointerId: 1, clientX: 0, clientY: 100});
    pad.handlers.pointermove({pointerId: 1, clientX: 120, clientY: 35});
    browser.flushFrames();
    pad.handlers.pointermove({pointerId: 1, clientX: 1120, clientY: 1035});
    browser.flushFrames();
    assert.deepEqual(browser.sockets[0].sent, [
        {type: 'move', dx: 360, dy: -195},
        {type: 'move', dx: 500, dy: 500},
    ]);
});


test('higher sensitivity persists and remains bounded by the pointer protocol', () => {
    const preferences = new Map();
    const browser = connectedPage({preferences});
    browser.element('sensitivity').value = '8';
    browser.element('sensitivity').handlers.input();
    const pad = browser.element('touchpad');
    pad.handlers.pointerdown({pointerId: 1, clientX: 0, clientY: 0});
    pad.handlers.pointermove({pointerId: 1, clientX: 20, clientY: 10});
    browser.flushFrames();
    assert.deepEqual(browser.sockets[0].sent, [{type: 'move', dx: 160, dy: 80}]);
    assert.equal(page({preferences}).element('sensitivity').value, '8');
});

test('typing uses the visible viewport and excludes reported keyboard toolbar occlusion', () => {
    const browser = connectedPage();
    assert.equal(browser.bodyClasses.has('typing'), true);
    browser.viewport.height = 320;
    browser.viewportEvents.resize();
    assert.equal(browser.viewportStyle.get('--app-height'), '320px');
    browser.keyboardBounds.y = 280;
    browser.keyboardBounds.height = 429;
    browser.keyboardEvents.geometrychange();
    assert.equal(browser.viewportStyle.get('--app-height'), '280px');
    browser.viewport.offsetTop = 20;
    browser.viewportEvents.scroll();
    assert.equal(browser.viewportStyle.get('--app-top'), '20px');
    assert.equal(browser.viewportStyle.get('--app-height'), '260px');
    browser.element('keyboard').handlers.click();
    assert.equal(browser.bodyClasses.has('typing'), false);
});


test('long IME commits followed by a final input event do not duplicate text or rewrite the mobile editor', () => {
    const browser = connectedPage();
    const input = browser.element('text');
    const value = 'Una frase bastante larga con palabras distintas y tildes. '.repeat(5);
    input.handlers.compositionstart();
    input.value = value;
    input.handlers.input({isComposing: true});
    input.handlers.compositionend();
    const editorAfterCommit = input.value;
    // Some keyboard event sequences report the final committed value again.
    input.value = value;
    input.handlers.input({isComposing: false});
    let desktop = '';
    for (const message of browser.sockets[0].sent) {
        const characters = Array.from(desktop);
        desktop = characters.slice(0, characters.length - message.remove).join('') + message.text;
    }
    assert.equal(desktop, value);
    assert.equal(editorAfterCommit, value, 'The editor must not be rewritten while the IME owns it');
});


test('saved sensitivities snap to half steps', () => {
    const browser = page({preferences: new Map([['pointerSensitivity', '2.85']])});
    assert.equal(browser.element('sensitivity').value, '3');
    browser.element('sensitivity').value = '3.5';
    browser.element('sensitivity').handlers.input();
    assert.equal(browser.element('sensitivity-value').textContent, '3.5×');
});

test('a typing timeout keeps the pointer connected and refocusing resumes the keyboard', () => {
    const browser = connectedPage();
    const socket = browser.sockets[0];
    socket.emit('message', {data: JSON.stringify({type: 'typing-paused'})});
    assert.equal(browser.element('typing').hidden, true);
    assert.equal(browser.element('left').disabled, false);
    browser.element('left').handlers.click();
    assert.deepEqual(socket.sent, [{type: 'click', button: 1}]);
    socket.emit('message', {data: JSON.stringify({type: 'focus', context: 8, active: true})});
    assert.equal(browser.element('status').textContent, 'Connected');
    assert.equal(browser.element('typing').hidden, false);
});


test('backgrounding Chrome suspends input and reconnects an approved tab without pairing again', async () => {
    const browser = connectedPage();
    const old = browser.sockets[0];
    old.emit('message', {data: JSON.stringify({type: 'approved', exchangeToken: 'exchange-secret'})});
    await browser.settle();
    browser.document.hidden = true;
    for (const callback of browser.documentEvents.get('visibilitychange')) callback();
    assert.deepEqual(old.sent.at(-1), {type: 'suspend'});
    assert.equal(browser.element('left').disabled, true);
    old.emit('close', {code: 1006});
    assert.equal(browser.timeouts.size, 0, 'No retries while the tab is hidden');
    browser.document.hidden = false;
    for (const callback of browser.documentEvents.get('visibilitychange')) callback();
    const resumed = browser.sockets[1];
    assert.equal(resumed.url, 'wss://192.168.1.147:8844/control');
    resumed.emit('message', {data: JSON.stringify({type: 'approved', exchangeToken: 'next-exchange'})});
    old.emit('close', {code: 1000});
    assert.equal(browser.element('status').textContent, 'Connected');
    assert.equal(browser.storage.has('resumeToken'), false);
});

test('returning to an open socket resumes it, while desktop revocation prevents automatic reconnect', async () => {
    const browser = connectedPage();
    const socket = browser.sockets[0];
    socket.emit('message', {data: JSON.stringify({type: 'approved', exchangeToken: 'exchange-secret'})});
    await browser.settle();
    browser.document.hidden = true;
    for (const callback of browser.documentEvents.get('visibilitychange')) callback();
    browser.document.hidden = false;
    for (const callback of browser.documentEvents.get('visibilitychange')) callback();
    assert.deepEqual(socket.sent.at(-1), {type: 'resume'});
    socket.emit('message', {data: JSON.stringify({type: 'resumed'})});
    assert.equal(browser.element('status').textContent, 'Connected');
    socket.emit('close', {code: 1000});
    assert.equal(browser.storage.has('resumeToken'), false);
    assert.equal(browser.timeouts.size, 0);
    assert.equal(browser.element('connect').disabled, true);
});

test('a stale open transport is replaced after the foreground resume probe times out', async () => {
    const browser = connectedPage();
    const socket = browser.sockets[0];
    socket.emit('message', {data: JSON.stringify({type: 'approved', exchangeToken: 'exchange-secret'})});
    await browser.settle();
    browser.document.hidden = true;
    for (const callback of browser.documentEvents.get('visibilitychange')) callback();
    browser.document.hidden = false;
    for (const callback of browser.documentEvents.get('visibilitychange')) callback();
    for (const [id, callback] of [...browser.timeouts]) {
        browser.timeouts.delete(id);
        callback();
    }
    assert.equal(browser.sockets.length, 2);
    assert.equal(browser.sockets[1].url, 'wss://192.168.1.147:8844/control');
});


test('a late resume response cannot reactivate controls after Chrome was hidden again', async () => {
    const browser = connectedPage();
    const socket = browser.sockets[0];
    socket.emit('message', {data: JSON.stringify({type: 'approved', exchangeToken: 'exchange-secret'})});
    await browser.settle();
    browser.document.hidden = true;
    for (const callback of browser.documentEvents.get('visibilitychange')) callback();
    socket.emit('message', {data: JSON.stringify({type: 'resumed'})});
    assert.equal(browser.element('left').disabled, true);
    browser.element('left').handlers.click();
    assert.equal(socket.sent.some(message => message.type === 'click'), false);
    assert.deepEqual(socket.sent.at(-1), {type: 'suspend'});
});


test('a pending invitation survives opening its URL in a new Chrome tab and disappears on approval', () => {
    const lens = page({hash: '#secret'});
    const chrome = page({hash: lens.location.hash});
    assert.equal(chrome.element('connect').disabled, false);
    chrome.element('connect').handlers.click();
    assert.equal(chrome.sockets[0].url, 'wss://192.168.1.147:8844/control');
    chrome.sockets[0].emit('open');
    assert.deepEqual(chrome.sockets[0].authentication, [{type: 'authenticate', token: 'secret'}]);
    chrome.sockets[0].emit('message', {data: JSON.stringify({type: 'approved', exchangeToken: 'exchange-secret'})});
    assert.equal(chrome.location.hash, '');
});


test('a new tab restores an approved cookie session without storing a JS-readable credential', async () => {
    const cookieJar = {authenticated: false};
    const first = connectedPage({cookieJar});
    first.sockets[0].emit('message', {data: JSON.stringify({type: 'approved', exchangeToken: 'exchange-secret'})});
    await first.settle();
    assert.equal(cookieJar.authenticated, true);
    assert.equal(first.storage.has('resumeToken'), false);
    const reopened = page({cookieJar});
    await reopened.settle();
    assert.equal(reopened.sockets.length, 1);
    assert.equal(reopened.sockets[0].url, 'wss://192.168.1.147:8844/control');
});

test('desktop sensitivity settings clamp the mobile value and apply live range changes', () => {
    const browser = page({hash: '#pairing', preferences: new Map([['pointerSensitivity', '8']])});
    browser.element('connect').handlers.click();
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'approved', sensitivity: {min: 1.5, max: 4}})});
    assert.equal(browser.element('sensitivity').min, '1.5');
    assert.equal(browser.element('sensitivity').max, '4');
    assert.equal(browser.element('sensitivity').value, '4');
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'settings', sensitivity: {min: 5, max: 12}})});
    assert.equal(browser.element('sensitivity').value, '5');
    assert.equal(browser.preferences.get('pointerSensitivity'), '5');
    browser.sockets[0].emit('message', {data: JSON.stringify({type: 'settings', sensitivity: {min: 12, max: 5}})});
    assert.equal(browser.element('sensitivity').value, '5');
});


test('Disconnect enables manual reconnect for remembered browsers without reconnecting on foreground', async () => {
    const browser = connectedPage({cookieJar: {authenticated: true, trusted: true}});
    await browser.settle();
    browser.element('disconnect').handlers.click();
    await browser.settle();
    assert.equal(browser.element('connect').disabled, false);
    assert.equal(browser.sockets.length, 1);
    assert.match(browser.element('status').textContent, /Tap Connect/);
    browser.document.hidden = false;
    for (const handler of browser.documentEvents.get('visibilitychange')) handler();
    assert.equal(browser.sockets.length, 1);
    browser.element('connect').handlers.click();
    assert.equal(browser.sockets.length, 2);
    assert.equal(browser.sockets[1].url, 'wss://192.168.1.147:8844/control');
});

test('Disconnect keeps Connect disabled when temporary approval has been revoked', async () => {
    const browser = connectedPage({cookieJar: {authenticated: true}});
    await browser.settle();
    browser.element('disconnect').handlers.click();
    await browser.settle();
    assert.equal(browser.element('connect').disabled, true);
    assert.equal(browser.sockets.length, 1);
});
