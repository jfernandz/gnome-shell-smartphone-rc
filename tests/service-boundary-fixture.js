import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {RemoteService} from '../service.js';
const [directory, mode] = ARGV;
let inputs = 0;
let failure = null;
const service = new RemoteService(directory, () => {}, () => inputs++, {address: '127.0.0.1', port: 0}, message => failure = message);
const started = service.start();
const child = service._process;
const socketDirectory = service._peerDirectory;
try {
    if (mode === 'cancel') {
        service.stop();
        let rejected = false;
        try { await started; } catch { rejected = true; }
        if (!rejected || service._startup || service._peer || service._dbusServer || Gio.File.new_for_path(socketDirectory).query_exists(null))
            throw Error('Cancelled startup left resources');
    } else if (mode === 'early-state') {
        let rejected = false;
        try { await started; } catch (error) { rejected = error.message.includes('startup state'); }
        if (!rejected) throw Error('Premature connected state was accepted');
    } else {
        await started;
        for (let i = 0; i < 100 && !failure; i++)
            await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => { resolve(); return GLib.SOURCE_REMOVE; }));
        if (!failure?.includes('Invalid input')) throw Error('Invalid helper input did not stop service');
    }
    if (inputs || service._process || service._peer || service._state !== 'off') throw Error('Input boundary failed closed');
    await new Promise((resolve, reject) => child.wait_async(null, (source, result) => {
        try { source.wait_finish(result); resolve(); } catch (error) { reject(error); }
    }));
    print(`PASS: ${mode} closes service before accepting input`);
} finally { service.stop(); }
