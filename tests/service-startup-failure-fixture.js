import {RemoteService} from '../service.js';
const options = {address: '127.0.0.1', port: Number(ARGV[1])};
const service = new RemoteService(ARGV[0], () => {}, () => { throw Error('Unexpected input'); }, options,
    message => { throw Error(`Unexpected running failure: ${message}`); });
try {
    await service.start();
    throw Error('Occupied port was accepted');
} catch (error) {
    if (!error.message.includes(`Port ${options.port} is already in use`) || !error.message.includes('Settings → Service → Network'))
        throw error;
}
if (service._process !== null || service._peer !== null || service._startup !== 0 || service._state !== 'off')
    throw Error('Failed startup left resources or active state');
options.port = 0;
try {
    const started = await service.start();
    if (!started.url.startsWith('http://127.0.0.1:')) throw Error('Retry did not start');
    print('PASS: occupied port reports corrective action, stops child, and permits retry');
} finally { service.stop(); }
