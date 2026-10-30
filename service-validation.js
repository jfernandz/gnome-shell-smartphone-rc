import {isPrivateIPv4} from './network.js';

const MAX_PORT = 65535;
const FINGERPRINT = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/;

// Validate independently of the helper at the Shell trust boundary.
export function isStartupResponse(message, options) {
    const match = /^(https?):\/\/([0-9.]+):(\d+)\/(?:#([a-f0-9]{64}))?$/.exec(message.url);
    if (!match)
        return false;
    const [, scheme, address, portText] = match;
    const port = Number(portText);
    if (port < 1 || port > MAX_PORT || address !== options.address || (options.port && port !== options.port))
        return false;
    if (scheme === 'http')
        return address === '127.0.0.1';
    return (address === '127.0.0.1' || isPrivateIPv4(address)) && FINGERPRINT.test(message.fingerprint);
}
