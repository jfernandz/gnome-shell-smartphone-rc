import {RemoteServer} from '../server.js';

for (const options of [
    {address: '192.168.1.5'},
    {address: '0.0.0.0', certificate: {}},
    {address: '8.8.8.8', certificate: {}},
    {address: 'example.org', certificate: {}},
    {address: '::', certificate: {}},
]) {
    let rejected = false;
    try {
        new RemoteServer('.', () => {}, () => {}, options);
    } catch {
        rejected = true;
    }
    if (!rejected)
        throw new Error(`Unsafe configuration accepted: ${JSON.stringify(options)}`);
}
const local = new RemoteServer('.', () => {}, () => {}, {port: 0});
if (!local.start().startsWith('http://127.0.0.1:'))
    throw new Error('Local test mode must bind to loopback.');
local.stop();
