import assert from 'node:assert/strict';
import test from 'node:test';
import {isStartupResponse} from '../service-validation.js';

const token = 'ab'.repeat(32);
const fingerprint = Array(32).fill('AB').join(':');
const message = (address, port = 8844, scheme = 'https') => ({url: `${scheme}://${address}:${port}/#${token}`, fingerprint});

test('Shell validates helper startup address, port, transport and fingerprint independently', () => {
    const options = {address: '192.168.1.2', port: 8844};
    assert.equal(isStartupResponse(message(options.address), options), true);
    assert.equal(isStartupResponse({...message(options.address), url: `https://${options.address}:8844/`}, options), true);
    for (const candidate of [message('192.168.1.3'), message(options.address, 8845),
        message(options.address, 8844, 'http'), {...message(options.address), fingerprint: 'AB'},
        {...message(options.address), url: `https://${options.address}:8844/#wrong`}])
        assert.equal(isStartupResponse(candidate, options), false);
    for (const port of [1, 65535])
        assert.equal(isStartupResponse(message(options.address, port), {...options, port: 0}), true);
    for (const port of [0, 65536])
        assert.equal(isStartupResponse(message(options.address, port), {...options, port: 0}), false);
    assert.equal(isStartupResponse(message('127.0.0.1', 1234, 'http'), {address: '127.0.0.1', port: 0}), true);
    assert.equal(isStartupResponse(message('8.8.8.8'), {address: '8.8.8.8', port: 0}), false);
});
