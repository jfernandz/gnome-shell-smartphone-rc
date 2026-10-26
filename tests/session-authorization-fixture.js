import {SessionAuthorization} from '../app/session-authorization.js';
function assert(value, message) { if (!value) throw Error(message); }
let counter = 0;
const trusted = new Set(['browser']);
const authorization = new SessionAuthorization({contains: id => trusted.has(id), touch() {}}, 60,
    () => `secret-${++counter}`, () => { throw Error('Unexpected expiry'); });
try {
    authorization.touch(true);
    const first = authorization.issueExchange();
    const second = authorization.issueExchange();
    assert(!authorization.validExchange(`Bearer ${first}`), 'Old exchange remained valid');
    assert(authorization.validExchange(`Bearer ${second}`), 'Current exchange is invalid');
    authorization.consumeExchange(true);
    const cookie = authorization.sessionSecret;
    assert(!authorization.validExchange(`Bearer ${second}`) && authorization.hasSession(cookie), 'Exchange was not one-use');
    assert(authorization.canResume && authorization.cookieAgeSeconds > 0, 'Cookie cannot recover the session');
    authorization.requestRemember(true);
    assert(authorization.consumeRememberRequest() && !authorization.consumeRememberRequest(), 'Enrollment request was not consumed once');
    authorization.bindTrustedBrowser('browser');
    assert(authorization.trustedId === 'browser' && authorization.hasSession(cookie), 'Trusted browser binding lost temporary authorization');
    let protectedSecret = false;
    try { authorization.sessionSecret = 'replaced'; } catch (error) { protectedSecret = error instanceof TypeError; }
    assert(protectedSecret && authorization.hasSession(cookie), 'Secret is writable outside its owner');
    const pending = authorization.issueExchange();
    authorization.cancelExchange();
    assert(!authorization.validExchange(`Bearer ${pending}`) && authorization.canResume, 'Transport interruption revoked recovery or retained the exchange');
    trusted.delete('browser');
    assert(!authorization.active() && !authorization.hasSession(cookie) && !authorization.canResume, 'Forgotten trust still authorizes recovery');
    authorization.clear();
    assert(authorization.trustedId === null && authorization.sessionSecret === null, 'Clear retained credentials');
    assert(!authorization.consumeRememberRequest(), 'Clear retained enrollment intent');
    const temporary = new SessionAuthorization(null, 60, () => 'temporary', () => {});
    temporary.requestRemember(true);
    assert(!temporary.consumeRememberRequest(), 'Temporary-only service accepted persistent enrollment');
    temporary.clear();
    print('PASS: authorization owns exchange, recovery, enrollment intent and revocation');
} finally { authorization.clear(); }
