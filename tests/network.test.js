import assert from 'node:assert/strict';
import test from 'node:test';
import {isPrivateIPv4} from '../network.js';

test('accepts only canonical private LAN IPv4 addresses', () => {
    for (const address of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.147'])
        assert.equal(isPrivateIPv4(address), true, address);
    for (const address of [null, '', '0.0.0.0', '127.0.0.1', '8.8.8.8', '172.15.1.1',
        '172.32.0.1', '192.168.256.1', '192.168.01.2', '192.168.1.2\n', '::1', 'example.org'])
        assert.equal(isPrivateIPv4(address), false, String(address));
});

test('GJS server rejects unencrypted LAN and nonprivate bindings', async () => {
    const {execFileSync} = await import('node:child_process');
    const output = execFileSync('gjs', ['-m', 'tests/network-config-fixture.js'], {encoding: 'utf8'});
    assert.equal(output, '');
});
