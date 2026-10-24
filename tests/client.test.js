import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {textChange, recentText} from '../web/editing.js';

const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');

function page({hash = '', storage = new Map(), blockedStorage = false} = {}) {
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
        constructor(url) {
            this.url = url;
            this.handlers = {};
            this.readyState = 1;
            this.sent = [];
            sockets.push(this);
        }
        addEventListener(type, callback) { this.handlers[type] = callback; }
        emit(type, event) { this.handlers[type](event); }
        close() { this.emit('close'); }
        send(value) { this.sent.push(JSON.parse(value)); }
    }
    const location = {hash, host: '192.168.1.147:8844', protocol: 'https:'};
    const frames = new Map();
    let nextFrame = 0;
    const context = vm.createContext({
        textChange, recentText, navigator: {virtualKeyboard: {show() {}}},
        document: {getElementById: element, querySelectorAll: () => [], addEventListener() {}},
        location, history: {replaceState() { location.hash = ''; }},
        sessionStorage: {
            getItem(key) { if (blockedStorage) throw new Error('Unavailable'); return storage.get(key) ?? null; },
            setItem(key, value) { if (blockedStorage) throw new Error('Unavailable'); storage.set(key, value); },
            removeItem(key) { if (blockedStorage) throw new Error('Unavailable'); storage.delete(key); },
        },
        WebSocket: Socket,
        requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
        cancelAnimationFrame(id) { frames.delete(id); }, performance: {now: () => 0},
    });
    for (const [file, name] of [['keyboard.js', 'createKeyboard'], ['touchpad.js', 'createTouchpad']]) {
        const moduleSource = readFileSync(new URL(`../web/${file}`, import.meta.url), 'utf8')
            .replace(/^import .*;\n/gm, '').replace('export function', 'function');
        context[name] = vm.runInContext(`(() => {${moduleSource}; return ${name};})()`, context);
    }
    vm.runInContext(source, context);
    function flushFrames() {
        for (const [id, callback] of [...frames]) {
            frames.delete(id);
            callback();
        }
    }
    return {element, sockets, location, storage, frames, flushFrames};
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
    assert.equal(scanned.location.hash, '');
    assert.equal(scanned.element('connect').disabled, false);
    const refreshed = page({storage});
    refreshed.element('connect').handlers.click();
    assert.equal(refreshed.sockets[0].url, 'wss://192.168.1.147:8844/control?token=secret');
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

function connectedPage() {
    const browser = page({hash: '#secret'});
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
