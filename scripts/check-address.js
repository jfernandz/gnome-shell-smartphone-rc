import {isPrivateIPv4} from '../network.js';

if (!isPrivateIPv4(ARGV[0]))
    throw new Error('Choose a private LAN IPv4 address (10.x.x.x, 172.16–31.x.x, or 192.168.x.x).');
