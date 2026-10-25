import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function certificates(directory, name, start, end) {
    const base = join(directory, name);
    mkdirSync(base);
    writeFileSync(join(base, 'index'), '');
    writeFileSync(join(base, 'serial'), '01\n');
    writeFileSync(join(base, 'ca.conf'), `[ca]
default_ca=local
[local]
database=${base}/index
serial=${base}/serial
new_certs_dir=${base}
default_md=sha256
policy=policy
x509_extensions=extensions
[policy]
commonName=supplied
[extensions]
subjectAltName=IP:192.168.5.4
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
`);
    execFileSync('openssl', ['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
        '-keyout', join(base, 'private-key.pem'), '-out', join(base, 'request'), '-subj', '/CN=Test'], {stdio: 'pipe'});
    execFileSync('openssl', ['ca', '-selfsign', '-batch', '-config', join(base, 'ca.conf'),
        '-keyfile', join(base, 'private-key.pem'), '-in', join(base, 'request'),
        '-startdate', start, '-enddate', end, '-out', join(base, 'certificate.pem')], {stdio: 'pipe'});
}

test('certificate dates, atomic setup, child cancellation and conservative cleanup', {timeout: 15000}, t => {
    const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-certificate-safety-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    certificates(directory, 'expired', '20200101000000Z', '20210101000000Z');
    certificates(directory, 'future', '20900101000000Z', '20910101000000Z');
    const result = execFileSync('gjs', ['-m', 'tests/certificate-safety-fixture.js', directory], {encoding: 'utf8', timeout: 12000});
    assert.equal(result.trim().split('\n').filter(line => line.startsWith('PASS:')).length, 5);
});
