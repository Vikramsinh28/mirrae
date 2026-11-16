import { createHmac } from 'node:crypto';

import { authenticateShopifyRequest } from './request';

const NOW = 1_800_000_000;
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function bearer(secret = 'the-secret') {
  const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    iss: 'https://my-store.myshopify.com/admin',
    dest: 'https://my-store.myshopify.com',
    aud: 'the-id',
    sub: '1',
    exp: NOW + 60,
    nbf: NOW - 5,
  })}`;
  return `Bearer ${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

describe('authenticateShopifyRequest', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = 'the-id';
    process.env.SHOPIFY_API_SECRET = 'the-secret';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  test('accepts a valid bearer token and says which shop it is for', () => {
    const auth = authenticateShopifyRequest(bearer(), NOW);

    expect(auth.ok && auth.identity.shop).toBe('my-store.myshopify.com');
  });

  test.each([null, '', 'Bearer', 'Basic abc', 'bearer abc.def.ghi', 'Bearer a b'])('refuses a missing or malformed header %p', header => {
    expect(authenticateShopifyRequest(header, NOW)).toEqual({ ok: false, reason: 'UNAUTHORIZED' });
  });

  test('refuses a token signed with another secret', () => {
    expect(authenticateShopifyRequest(bearer('attacker'), NOW)).toEqual({ ok: false, reason: 'UNAUTHORIZED' });
  });

  test('says so when the app credentials are not configured, instead of calling every token bad', () => {
    delete process.env.SHOPIFY_API_SECRET;

    expect(authenticateShopifyRequest(bearer(), NOW)).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
  });
});
