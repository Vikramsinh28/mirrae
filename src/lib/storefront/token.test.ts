import { createHmac } from 'node:crypto';

import { signStorefrontToken, verifyStorefrontToken } from './token';

const SECRET = 'test-storefront-secret-with-enough-length-0123456789';
const NOW = Date.parse('2026-11-14T10:00:00Z');
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

describe('storefront token', () => {
  const original = process.env.STOREFRONT_TOKEN_SECRET;

  beforeEach(() => {
    process.env.STOREFRONT_TOKEN_SECRET = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.STOREFRONT_TOKEN_SECRET;
    else process.env.STOREFRONT_TOKEN_SECRET = original;
  });

  test('a signed token verifies and returns the shop and session it was issued for', () => {
    const token = signStorefrontToken({ shopId: 'shop-1', sessionId: 'sess-1' }, NOW);

    expect(verifyStorefrontToken(token, NOW + 1000)).toEqual({ shopId: 'shop-1', sessionId: 'sess-1' });
  });

  test('expires after the time to live', () => {
    const token = signStorefrontToken({ shopId: 'shop-1', sessionId: 'sess-1' }, NOW);

    expect(verifyStorefrontToken(token, NOW + TWO_HOURS_MS - 1)).not.toBeNull();
    expect(verifyStorefrontToken(token, NOW + TWO_HOURS_MS + 1)).toBeNull();
  });

  test('rejects a token whose payload was edited to point at another shop', () => {
    const token = signStorefrontToken({ shopId: 'shop-1', sessionId: 'sess-1' }, NOW);
    const [, signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ shopId: 'shop-2', sessionId: 'sess-1', exp: NOW + TWO_HOURS_MS })
    ).toString('base64url');

    expect(verifyStorefrontToken(`${forgedPayload}.${signature}`, NOW)).toBeNull();
  });

  test('rejects a token signed with a different secret', () => {
    const payload = Buffer.from(
      JSON.stringify({ shopId: 'shop-1', sessionId: 'sess-1', exp: NOW + TWO_HOURS_MS })
    ).toString('base64url');
    const signature = createHmac('sha256', 'some-other-secret').update(payload).digest('base64url');

    expect(verifyStorefrontToken(`${payload}.${signature}`, NOW)).toBeNull();
  });

  test.each(['', 'abc', 'a.b.c', '.', 'not-base64.not-base64', 'e30.e30'])('rejects the malformed token %p', token => {
    expect(verifyStorefrontToken(token, NOW)).toBeNull();
  });

  test('rejects a validly signed payload that is missing fields', () => {
    const payload = Buffer.from(JSON.stringify({ shopId: 'shop-1', exp: NOW + TWO_HOURS_MS })).toString('base64url');
    const signature = createHmac('sha256', SECRET).update(payload).digest('base64url');

    expect(verifyStorefrontToken(`${payload}.${signature}`, NOW)).toBeNull();
  });

  test('refuses to sign or verify when the secret is missing or too short', () => {
    delete process.env.STOREFRONT_TOKEN_SECRET;
    expect(() => signStorefrontToken({ shopId: 's', sessionId: 'x' }, NOW)).toThrow(/STOREFRONT_TOKEN_SECRET/);

    process.env.STOREFRONT_TOKEN_SECRET = 'short';
    expect(() => signStorefrontToken({ shopId: 's', sessionId: 'x' }, NOW)).toThrow(/STOREFRONT_TOKEN_SECRET/);
    expect(verifyStorefrontToken('a.b', NOW)).toBeNull();
  });
});
