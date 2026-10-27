import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {X509Certificate, randomBytes} from 'node:crypto';
import {once} from 'node:events';
import https from 'node:https';

if (process.env.SMARTPHONE_RC_ISOLATED_SHELL !== '1' || !process.argv[2] || !process.argv[3])
    throw Error('Use SMARTPHONE_RC_ISOLATED_SHELL=1 and pass isolated bus-file and runtime-directory paths.');
const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-native-security-'));
const bus = readFileSync(process.argv[2], 'utf8');
const runtimeDirectory = process.argv[3];
const base = 'Main.extensionManager.lookup("smartphone-rc@jfaparicio.github.io").stateObj';

function evaluate(code) {
    const result = execFileSync('gdbus', ['call', '--address', bus, '--dest', 'org.gnome.Shell',
        '--object-path', '/org/gnome/Shell', '--method', 'org.gnome.Shell.Eval', code], {encoding: 'utf8'});
    assert.ok(result.startsWith('(true,'), result);
    return result;
}

async function wait(code) {
    for (let attempt = 0; attempt < 200; attempt++) {
        if (evaluate(code).includes("'true'")) return;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error(`Native security condition timed out: ${code}`);
}

let socket;
try {
    execFileSync('openssl', ['req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
        '-nodes', '-days', '1', '-subj', '/CN=Native Test', '-addext', 'subjectAltName=IP:127.0.0.1',
        '-keyout', `${directory}/key.pem`, '-out', `${directory}/cert.pem`], {stdio: 'ignore'});
    const certificate = readFileSync(`${directory}/cert.pem`);
    const options = {address: '127.0.0.1', port: 0, certificatePath: `${directory}/cert.pem`,
        privateKeyPath: `${directory}/key.pem`, fingerprint: new X509Certificate(certificate).fingerprint256};

    async function connect() {
        evaluate(`(async()=>{
            const extension = ${base};
            extension._networkOptions = () => (${JSON.stringify(options)});
            await extension._start();
            return extension._server !== null;
        })()`);
        await wait(`typeof ${base}._url === 'string'`);
        const url = new URL(readFileSync(join(runtimeDirectory, 'smartphone-rc-session'), 'utf8'));
        const request = https.request(`${url.origin}/control`, {ca: certificate, headers: {
            Origin: url.origin, Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        }});
        const ready = once(request, 'upgrade');
        request.end();
        [, socket] = await ready;
        socket.on('data', () => {});
        const body = Buffer.from(JSON.stringify({type: 'authenticate', token: url.hash.slice(1)}));
        const mask = randomBytes(4);
        socket.write(Buffer.concat([Buffer.from([0x81, 0x80 | body.length]), mask,
            Buffer.from(body.map((byte, index) => byte ^ mask[index % 4]))]));
        await wait(`${base}._server?._state === 'pending'`);
    }

    assert.ok(evaluate(`${base}._startAction.visible && !${base}._stopAction.visible && !${base}._disconnectAction.visible`).includes("'true'"));
    await connect();
    assert.ok(evaluate(`!${base}._startAction.visible && ${base}._stopAction.visible && ${base}._disconnectAction.visible && ${base}._disconnectAction.label.text === 'Reject request'`).includes("'true'"));
    assert.ok(evaluate(`(()=>{
        const extension = ${base};
        const notification = extension._notification;
        extension._remember.setToggleState(true);
        extension._onSessionState('pending');
        return extension._notification === notification && extension._remember.state;
    })()`).includes("'true'"));
    evaluate(`${base}._notification._actions[0].activate()`);
    await wait(`${base}._dialogs._verification !== null`);
    evaluate(`(()=>{
        const dialog = ${base}._dialogs._verification;
        const button = dialog.buttonLayout.get_last_child();
        if (button.reactive) throw Error('Approval enabled before verification');
        button.emit('clicked', 1);
        return true;
    })()`);
    assert.ok(evaluate(`${base}._server._state === 'pending'`).includes("'true'"));
    evaluate(`(()=>{
        const dialog = ${base}._dialogs._verification;
        dialog.contentLayout.get_children().find(actor => actor.toggle_mode).checked = true;
        const button = dialog.buttonLayout.get_last_child();
        if (!button.reactive) throw Error('Approval still disabled');
        button.emit('clicked', 1);
        return true;
    })()`);
    await wait(`${base}._server?._state === 'connected'`);
    assert.ok(evaluate(`${base}._focus !== null && ${base}._volume !== null && ${base}._volume._control.get_vol_max_norm() > 0`).includes("'true'"));
    console.log('PASS: connected session owns a native GNOME mixer observer');
    assert.ok(evaluate(`!${base}._startAction.visible && ${base}._stopAction.visible && ${base}._disconnectAction.label.text === 'Disconnect phone'`).includes("'true'"));
    assert.ok(evaluate(`(()=>{
        const extension = ${base};
        const focus = extension._focus;
        const volume = extension._volume;
        const cancelKeyboard = extension._input.cancelKeyboard;
        let cancellations = 0;
        extension._input.cancelKeyboard = () => cancellations++;
        try {
            extension._onSessionState('connected');
            return extension._focus === focus && extension._volume === volume && cancellations === 0;
        } finally {
            extension._input.cancelKeyboard = cancelKeyboard;
        }
    })()`).includes("'true'"));
    console.log('PASS: repeated states preserve pending approval, notification, focus and keyboard');
    console.log('PASS: TLS native approval requires fingerprint acknowledgement before input becomes available');

    evaluate(`${base}._server._process.force_exit()`);
    await wait(`${base}._server === null`);
    assert.ok(evaluate(`${base}._input === null && ${base}._focus === null && ${base}._volume === null`).includes("'true'"));
    socket.destroy();
    console.log('PASS: helper crash stops native input/focus while GNOME remains alive');

    await connect();
    evaluate(`${base}._approveRequest(false)`);
    evaluate(`(()=>{
        const extension = ${base};
        const dialogs = extension._dialogs;
        Main.sessionMode.pushMode('unlock-dialog');
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            GLib.file_set_contents(${JSON.stringify(join(directory, 'lock.json'))}, JSON.stringify({
                stopped: extension._server === null, closed: dialogs._verification === null,
            }));
            Main.sessionMode.popMode('unlock-dialog');
            return GLib.SOURCE_REMOVE;
        });
        return true;
    })()`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'lock.json'), 'utf8')), {stopped: true, closed: true});
    assert.ok(evaluate(`${base}._server === null`).includes("'true'"));
    assert.ok(evaluate(`${base}._startAction.visible && !${base}._stopAction.visible && !${base}._disconnectAction.visible`).includes("'true'"));
    console.log('PASS: menu actions reflect stopped, pending, connected and post-lock states');
    console.log('PASS: lock mode closes certificate approval and helper, without automatic restart after unlock');
    evaluate(`(()=>{
        const extension = ${base};
        global._remotePendingRead = false;
        extension._networkOptions = () => {
            global._remotePendingRead = true;
            return new Promise(resolve => {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                    resolve(${JSON.stringify(options)});
                    return GLib.SOURCE_REMOVE;
                });
            });
        };
        extension._start();
        return true;
    })()`);
    await wait('global._remotePendingRead === true');
    evaluate(`${base}._stop()`);
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.ok(evaluate(`${base}._server === null && ${base}._startAction.visible && ${base}._dialogs._certificate === null`).includes("'true'"));
    console.log('PASS: Stop cancels pending asynchronous startup without a helper or setup dialog');

    evaluate(`(()=>{
        const extension = ${base};
        global._remotePendingRead = false;
        global._remoteDisabledExtension = extension;
        global._remoteDestroyedRows = 0;
        for (const row of [extension._status, extension._address, extension._remember])
            row.connect('destroy', () => global._remoteDestroyedRows++);
        extension._start();
        return true;
    })()`);
    await wait('global._remotePendingRead === true');
    evaluate('Main.extensionManager.disableExtension("smartphone-rc@jfaparicio.github.io")');
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.ok(evaluate('global._remoteDestroyedRows === 3 && global._remoteDisabledExtension._server === null && global._remoteDisabledExtension._indicator === null').includes("'true'"));
    evaluate('Main.extensionManager.enableExtension("smartphone-rc@jfaparicio.github.io")');
    await wait(`${base}._indicator !== null`);
    console.log('PASS: disable during asynchronous startup destroys all three menu rows and cannot start a stale helper');

} finally {
    socket?.destroy();
    evaluate(`${base}._stop()`);
    rmSync(directory, {recursive: true, force: true});
}
