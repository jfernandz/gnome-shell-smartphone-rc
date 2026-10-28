import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

for (const mode of ['typed', 'wrong-parent', 'size', 'rate', 'queue']) {
    test(`private D-Bus peer: ${mode}`, () => {
        const output = execFileSync('gjs', ['-m', 'tests/dbus-fixture.js', mode], {encoding: 'utf8', timeout: 6000});
        assert.match(output, /^PASS:/);
    });
}

for (const mode of ['cancel', 'early-state', 'invalid-input', 'invalid-session-action']) {
    test(`service D-Bus boundary: ${mode}`, async t => {
        const {mkdtempSync, writeFileSync, rmSync} = await import('node:fs');
        const {tmpdir} = await import('node:os');
        const {join} = await import('node:path');
        const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-dbus-boundary-'));
        t.after(() => rmSync(directory, {recursive: true, force: true}));
        execFileSync('bash', ['scripts/lib/stage.sh', directory]);
        if (mode !== 'cancel') {
            writeFileSync(`${directory}/app/service-worker.js`, `import GLib from 'gi://GLib';
import {DBusPeer, connectToParent} from '../dbus.js';
const connection = await connectToParent(ARGV[0], Number(ARGV[1]));
const loop = new GLib.MainLoop(null, false);
const peer = new DBusPeer(connection, 'service', command => {
    if (command.type === 'start') {
        peer.send({type:'state',state:'listening',peer:null,browserName:null});
        peer.send({type:'started',url:'http://127.0.0.1:12345/#'+'ab'.repeat(32),fingerprint:null});
        peer.send({type:'state',state:'connected',peer:'127.0.0.1',browserName:null});
        peer.send(${mode === 'invalid-session-action' ? "{type:'input',input:{type:'session-action',action:'reboot'}}" : "{type:'input',input:{type:'move',dx:501,dy:0}}"});
    }
}, () => loop.quit());
connection.start_message_processing();
peer.send(${mode === 'early-state' ? "{type:'state',state:'connected',peer:'127.0.0.1',browserName:null}" : "{type:'ready'}"});
loop.run();
peer.close();
`);
        }
        const output = execFileSync('gjs', ['-m', 'tests/service-boundary-fixture.js', directory, mode], {encoding: 'utf8', timeout: 6000});
        assert.match(output, /^PASS:/);
    });
}
