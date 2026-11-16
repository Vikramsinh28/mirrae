import { createHmac } from 'node:crypto';

import { verifySessionToken } from './session-token';

const CLIENT_ID = 'client-id-123';
const SECRET = 'client-secret-abc';
const NOW = 1_800_000_000; // seconds
const SHOP = 'my-store.myshopify.com';

const b64 = (value: object | string) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function token(claims: Record<string, unknown> = {}, { secret = SECRET, header = { alg: 'HS256', typ: 'JWT' } } = {}) {
  const body = {
    iss: `https://${SHOP}/admin`,
    dest: `https://${SHOP}`,
    aud: CLIENT_ID,
    sub: '42',
    exp: NOW + 60,
    nbf: NOW - 5,
    iat: NOW - 5,
    jti: 'abc',
    ...claims,
  };
  const unsigned = `${b64(header)}.${b64(body)}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

const verify = (value: string) => verifySessionToken(value, { clientId: CLIENT_ID, clientSecret: SECRET, nowSeconds: NOW });

describe('verifySessionToken', () => {
  test('accepts a token Shopify signed for this app and returns the shop it came from', () => {
    expect(verify(token())).toEqual({ shop: SHOP, userId: '42' });
  });

  test('refuses a token signed with another secret', () => {
    expect(verify(token({}, { secret: 'attacker' }))).toBeNull();
  });

  test('refuses a token meant for another app (wrong audience)', () => {
    expect(verify(token({ aud: 'other-app' }))).toBeNull();
  });

  test('refuses an expired token, but tolerates a few seconds of clock drift', () => {
    expect(verify(token({ exp: NOW - 30 }))).toBeNull();
    expect(verify(token({ exp: NOW - 3 }))).not.toBeNull();
  });

  test('refuses a token that is not valid yet', () => {
    expect(verify(token({ nbf: NOW + 60 }))).toBeNull();
  });

  test('refuses the "none" algorithm and any other algorithm than HS256', () => {
    expect(verify(token({}, { header: { alg: 'none', typ: 'JWT' } }))).toBeNull();
    expect(verify(token({}, { header: { alg: 'HS512', typ: 'JWT' } }))).toBeNull();
  });

  test('refuses a token whose shop is not a myshopify.com store', () => {
    expect(verify(token({ dest: 'https://evil.com', iss: 'https://evil.com/admin' }))).toBeNull();
  });

  test('refuses a token whose issuer is a different shop than its destination', () => {
    expect(verify(token({ iss: 'https://other-store.myshopify.com/admin' }))).toBeNull();
  });

  test.each(['', 'abc', 'a.b', 'a.b.c.d', '..'])('refuses malformed input %p', value => {
    expect(verify(value)).toBeNull();
  });

  test('refuses everything when the app credentials are not configured', () => {
    expect(verifySessionToken(token(), { clientId: '', clientSecret: '', nowSeconds: NOW })).toBeNull();
  });
});
