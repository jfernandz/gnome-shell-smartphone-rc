import GLib from 'gi://GLib';
import GLibUnix from 'gi://GLibUnix';
import {RemoteServer} from '../server.js';

const server = new RemoteServer(GLib.get_current_dir(), state => {
    print(JSON.stringify({state}));
    if (state === 'pending') {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            server.approve();
            return GLib.SOURCE_REMOVE;
        });
    }
}, input => print(JSON.stringify({input})));
print(JSON.stringify({url: server.start()}));
const loop = new GLib.MainLoop(null, false);
GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
    server.stop();
    loop.quit();
    return GLib.SOURCE_REMOVE;
});
loop.run();
