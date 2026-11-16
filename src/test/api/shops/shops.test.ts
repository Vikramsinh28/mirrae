/**
 * Route-handler tests for the merchant shops API. The service is mocked; these check the HTTP layer:
 * login required, input validation, status codes, and that every call is scoped to the signed-in merchant.
 */
import { NextRequest } from 'next/server';

import { getAuthUser } from '@/lib/auth/jwt';
import { verificationLimiter } from '@/lib/shops/verification-limits';
import { ShopService } from '@/services/internal/shop';
import { ShopVerificationService } from '@/services/internal/shop-verification';
import { getUserById } from '@/services/repositories/user';

jest.mock('@/lib/auth/jwt', () => ({ getAuthUser: jest.fn(), JWT_KEY: 'auth-token' }));
jest.mock('@/services/repositories/user', () => ({ getUserById: jest.fn() }));
jest.mock('@/lib/shops/verification-limits', () => ({ verificationLimiter: { check: jest.fn() } }));
jest.mock('@/services/internal/shop-verification', () => ({
  ShopVerificationService: { instructions: jest.fn(), verify: jest.fn(), claimInstructions: jest.fn(), claim: jest.fn() },
}));
jest.mock('@/services/internal/shop', () => ({
  MAX_SHOPS_PER_OWNER: 5,
  ShopService: { create: jest.fn(), list: jest.fn(), get: jest.fn(), update: jest.fn(), rotateKey: jest.fn(), usage: jest.fn(), setupStatus: jest.fn() },
}));

const auth = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const userById = getUserById as jest.MockedFunction<typeof getUserById>;
const service = ShopService as jest.Mocked<typeof ShopService>;
const verification = ShopVerificationService as jest.Mocked<typeof ShopVerificationService>;
const limiter = verificationLimiter.check as jest.Mock;

const user = { id: 7, email: 'merchant@example.com', role: 'USER' };
const SHOP_ID = '8a1f0c52-1111-4222-8333-444455556666';
const shop = { id: SHOP_ID, name: 'My Store', domain: 'www.example.com', publicKey: 'pk_live_aaa', status: 'ACTIVE' } as never;

const call = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const withId = (id: string) => ({ params: Promise.resolve({ id }) });

function signIn(signedIn: boolean) {
  auth.mockResolvedValue((signedIn ? { userId: user.id } : null) as never);
  userById.mockResolvedValue((signedIn ? user : null) as never);
}

describe('Shops API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signIn(true);
    limiter.mockReturnValue({ allowed: true, remaining: 5, retryAfterMs: 0 });
  });

  describe('GET /api/shops', () => {
    const get = async () => (await import('@/app/api/shops/route')).GET(call('http://localhost/api/shops'));

    test("lists the signed-in merchant's shops", async () => {
      service.list.mockResolvedValue([{ ...(shop as object), tryOnsLast7Days: 3 }] as never);

      const response = await get();

      expect(response.status).toBe(200);
      expect((await response.json()).data.shops[0]).toMatchObject({ id: SHOP_ID, tryOnsLast7Days: 3 });
      expect(service.list).toHaveBeenCalledWith(user.id);
    });

    test('needs a login', async () => {
      signIn(false);

      expect((await get()).status).toBe(401);
      expect(service.list).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/shops', () => {
    const post = async (body: unknown) => (await import('@/app/api/shops/route')).POST(call('http://localhost/api/shops', 'POST', body));

    test('creates a shop from a name and a website, cleaning the website up first', async () => {
      service.create.mockResolvedValue({ ok: true, shop });

      const response = await post({ name: ' My Store ', domain: 'https://WWW.Example.com/products/x' });

      expect(response.status).toBe(201);
      expect((await response.json()).data.shop).toMatchObject({ id: SHOP_ID });
      expect(service.create).toHaveBeenCalledWith(user.id, {
        name: 'My Store',
        domain: 'www.example.com',
        allowedOrigins: ['https://www.example.com', 'https://example.com'],
        imageHosts: [],
      });
    });

    test('needs a login', async () => {
      signIn(false);

      expect((await post({ name: 'x', domain: 'example.com' })).status).toBe(401);
      expect(service.create).not.toHaveBeenCalled();
    });

    test.each([
      ['no name', { domain: 'example.com' }],
      ['an empty name', { name: ' ', domain: 'example.com' }],
      ['an IP address as the website', { name: 'x', domain: '203.0.113.9' }],
      ['no website', { name: 'x' }],
      ['a body that is not JSON', undefined],
    ])('rejects %s with 400', async (_name, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(service.create).not.toHaveBeenCalled();
    });

    test('says so when the merchant already has the maximum number of shops', async () => {
      service.create.mockResolvedValue({ ok: false, reason: 'LIMIT_REACHED' });

      const response = await post({ name: 'x', domain: 'example.com' });

      expect(response.status).toBe(409);
      expect(JSON.stringify(await response.json())).toContain('5');
    });

    test('says so when the website is already registered by someone', async () => {
      service.create.mockResolvedValue({ ok: false, reason: 'DOMAIN_TAKEN' });

      const response = await post({ name: 'x', domain: 'example.com' });

      expect(response.status).toBe(409);
      expect(JSON.stringify(await response.json())).toMatch(/already/i);
    });
  });

  describe('GET /api/shops/[id]', () => {
    const get = async (id = SHOP_ID) =>
      (await import('@/app/api/shops/[id]/route')).GET(call(`http://localhost/api/shops/${id}`), withId(id));

    test("returns the merchant's own shop", async () => {
      service.get.mockResolvedValue(shop);

      const response = await get();

      expect(response.status).toBe(200);
      expect((await response.json()).data.shop).toMatchObject({ publicKey: 'pk_live_aaa' });
      expect(service.get).toHaveBeenCalledWith(user.id, SHOP_ID);
    });

    test('is 404 for a shop that belongs to someone else, revealing nothing', async () => {
      service.get.mockResolvedValue(null);

      expect((await get()).status).toBe(404);
    });

    test('is 404 for an id that is not a uuid, without touching the database', async () => {
      expect((await get('1 OR 1=1')).status).toBe(404);
      expect(service.get).not.toHaveBeenCalled();
    });

    test('needs a login', async () => {
      signIn(false);

      expect((await get()).status).toBe(401);
    });
  });

  describe('PATCH /api/shops/[id]', () => {
    const patch = async (body: unknown, id = SHOP_ID) =>
      (await import('@/app/api/shops/[id]/route')).PATCH(call(`http://localhost/api/shops/${id}`, 'PATCH', body), withId(id));

    test('saves what the merchant changed', async () => {
      service.update.mockResolvedValue({ ok: true, shop });

      const response = await patch({ dailyTryOnCap: 50, allowedOrigins: ['https://Shop.Example.com/x'] });

      expect(response.status).toBe(200);
      expect(service.update).toHaveBeenCalledWith(user.id, SHOP_ID, {
        dailyTryOnCap: 50,
        allowedOrigins: ['https://shop.example.com'],
      });
    });

    test.each([
      ['an empty update', {}],
      ['a status only we may set', { status: 'SUSPENDED' }],
      ['an unsafe website list', { allowedOrigins: ['*'] }],
      ['a cap that is too high', { dailyTryOnCap: 999999 }],
      ['a body that is not JSON', undefined],
    ])('rejects %s with 400', async (_name, body) => {
      expect((await patch(body)).status).toBe(400);
      expect(service.update).not.toHaveBeenCalled();
    });

    test('is 404 for someone else\'s shop', async () => {
      service.update.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });
      expect((await patch({ name: 'x' })).status).toBe(404);
    });

    test('is 403 when the merchant tries to change the status of a shop we suspended', async () => {
      service.update.mockResolvedValue({ ok: false, reason: 'LOCKED' });
      expect((await patch({ status: 'ACTIVE' })).status).toBe(403);
    });

    test('needs a login', async () => {
      signIn(false);
      expect((await patch({ name: 'x' })).status).toBe(401);
      expect(service.update).not.toHaveBeenCalled();
    });

    test('is 404 for an id that is not a uuid', async () => {
      expect((await patch({ name: 'x' }, 'nope')).status).toBe(404);
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/shops/[id]/rotate-key', () => {
    const rotate = async (id = SHOP_ID) =>
      (await import('@/app/api/shops/[id]/rotate-key/route')).POST(call(`http://localhost/api/shops/${id}/rotate-key`, 'POST'), withId(id));

    test('returns the shop with its new public key', async () => {
      service.rotateKey.mockResolvedValue({ ok: true, shop: { ...(shop as object), publicKey: 'pk_live_new' } as never });

      const response = await rotate();

      expect(response.status).toBe(200);
      expect((await response.json()).data.shop.publicKey).toBe('pk_live_new');
      expect(service.rotateKey).toHaveBeenCalledWith(user.id, SHOP_ID);
    });

    test('is 404 for someone else\'s shop or a bad id', async () => {
      service.rotateKey.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });
      expect((await rotate()).status).toBe(404);

      service.rotateKey.mockClear();
      expect((await rotate('nope')).status).toBe(404);
      expect(service.rotateKey).not.toHaveBeenCalled();
    });

    test('needs a login', async () => {
      signIn(false);
      expect((await rotate()).status).toBe(401);
    });
  });

  describe('GET /api/shops/[id]/usage', () => {
    const usage = async (query = '', id = SHOP_ID) =>
      (await import('@/app/api/shops/[id]/usage/route')).GET(call(`http://localhost/api/shops/${id}/usage${query}`), withId(id));

    test('returns the usage, 30 days unless the merchant asked for another window', async () => {
      service.usage.mockResolvedValue({ ok: true, usage: { days: 30 } as never });

      const response = await usage();

      expect(response.status).toBe(200);
      expect((await response.json()).data.usage).toEqual({ days: 30 });
      expect(service.usage).toHaveBeenCalledWith(user.id, SHOP_ID, 30);

      await usage('?days=7');
      expect(service.usage).toHaveBeenLastCalledWith(user.id, SHOP_ID, 7);
    });

    test.each(['?days=0', '?days=9999', '?days=abc', '?days=7.5'])('rejects %s with 400', async query => {
      expect((await usage(query)).status).toBe(400);
      expect(service.usage).not.toHaveBeenCalled();
    });

    test('is 404 for someone else\'s shop and for a bad id', async () => {
      service.usage.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });
      expect((await usage()).status).toBe(404);
      expect((await usage('', 'nope')).status).toBe(404);
    });

    test('needs a login', async () => {
      signIn(false);
      expect((await usage()).status).toBe(401);
    });
  });

  describe('GET /api/shops/setup-status', () => {
    const get = async () => {
      const { GET } = await import('@/app/api/shops/setup-status/route');
      return GET(call('http://localhost/api/shops/setup-status'));
    };

    test('needs a signed-in merchant', async () => {
      signIn(false);

      expect((await get()).status).toBe(401);
      expect(service.setupStatus).not.toHaveBeenCalled();
    });

    test("answers for the signed-in merchant only", async () => {
      service.setupStatus.mockResolvedValue({ testedTryOn: true, installed: false, shopperTryOn: false });

      const response = await get();

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ testedTryOn: true, installed: false, shopperTryOn: false });
      expect(service.setupStatus).toHaveBeenCalledWith(user.id);
    });
  });

  describe('website verification', () => {
    const verificationGet = async (id = SHOP_ID) =>
      (await import('@/app/api/shops/[id]/verification/route')).GET(call(`http://localhost/api/shops/${id}/verification`), withId(id));
    const verifyPost = async (id = SHOP_ID) =>
      (await import('@/app/api/shops/[id]/verify/route')).POST(call(`http://localhost/api/shops/${id}/verify`, 'POST'), withId(id));
    const record = { name: '_mirrae-verification.www.example.com', value: 'mirrae-verification=abc' };

    test('all three need a signed-in merchant', async () => {
      signIn(false);

      expect((await verificationGet()).status).toBe(401);
      expect((await verifyPost()).status).toBe(401);
      expect(verification.instructions).not.toHaveBeenCalled();
      expect(verification.verify).not.toHaveBeenCalled();
    });

    test('shows the record to add, for the merchant\'s own shop', async () => {
      verification.instructions.mockResolvedValue({ ok: true, verified: false, record });

      const response = await verificationGet();

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ verified: false, record });
      expect(verification.instructions).toHaveBeenCalledWith(user.id, SHOP_ID);
    });

    test('answers 404 for a shop that is not theirs or an id that is not a uuid', async () => {
      verification.instructions.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });

      expect((await verificationGet()).status).toBe(404);
      expect((await verificationGet('nope')).status).toBe(404);
      expect((await verifyPost('nope')).status).toBe(404);
    });

    test('verifying succeeds when the record is found', async () => {
      verification.verify.mockResolvedValue({ ok: true });

      const response = await verifyPost();

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ verified: true });
    });

    test('tells the merchant when the record is not there yet (422) or DNS could not be read (503)', async () => {
      verification.verify.mockResolvedValueOnce({ ok: false, reason: 'NO_RECORD' }).mockResolvedValueOnce({ ok: false, reason: 'LOOKUP_FAILED' });

      const missing = await verifyPost();
      const broken = await verifyPost();

      expect(missing.status).toBe(422);
      expect((await missing.json()).code).toBe('NO_RECORD');
      expect(broken.status).toBe(503);
    });

    test('limits how often DNS can be checked, and does not check once the limit is hit', async () => {
      limiter.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 20_000 });

      const response = await verifyPost();

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('20');
      expect(verification.verify).not.toHaveBeenCalled();
    });
  });

  describe('claiming a website', () => {
    const claimGet = async (domain: string) =>
      (await import('@/app/api/shops/claim/route')).GET(call(`http://localhost/api/shops/claim?domain=${encodeURIComponent(domain)}`));
    const claimPost = async (body: unknown) => (await import('@/app/api/shops/claim/route')).POST(call('http://localhost/api/shops/claim', 'POST', body));

    test('both need a signed-in merchant', async () => {
      signIn(false);

      expect((await claimGet('www.example.com')).status).toBe(401);
      expect((await claimPost({ name: 'Store', domain: 'www.example.com' })).status).toBe(401);
    });

    test('gives the record to add for a website', async () => {
      verification.claimInstructions.mockResolvedValue({ record: { name: '_mirrae-verification.www.example.com', value: 'mirrae-verification=abc' } });

      const response = await claimGet('www.example.com');

      expect(response.status).toBe(200);
      expect(verification.claimInstructions).toHaveBeenCalledWith(user.id, 'www.example.com');
    });

    test('rejects a website address that is not valid', async () => {
      expect((await claimGet('not a domain')).status).toBe(400);
      expect(verification.claimInstructions).not.toHaveBeenCalled();
    });

    test('creates the verified shop when the proof is found', async () => {
      verification.claim.mockResolvedValue({ ok: true, shop });

      const response = await claimPost({ name: 'My Store', domain: 'www.example.com' });

      expect(response.status).toBe(201);
      expect(verification.claim).toHaveBeenCalledWith(user.id, expect.objectContaining({ name: 'My Store', domain: 'www.example.com' }));
    });

    test.each([
      ['NOT_CLAIMABLE', 409],
      ['LIMIT_REACHED', 409],
      ['NO_RECORD', 422],
      ['LOOKUP_FAILED', 503],
    ] as const)('maps %s to HTTP %i', async (reason, status) => {
      verification.claim.mockResolvedValue({ ok: false, reason });

      expect((await claimPost({ name: 'My Store', domain: 'www.example.com' })).status).toBe(status);
    });

    test('is limited like a verification check', async () => {
      limiter.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 5_000 });

      expect((await claimPost({ name: 'My Store', domain: 'www.example.com' })).status).toBe(429);
      expect(verification.claim).not.toHaveBeenCalled();
    });
  });

  describe('creating a shop for a website someone else registered unverified', () => {
    test('answers 409 with a code that lets the dashboard offer the claim', async () => {
      service.create.mockResolvedValue({ ok: false, reason: 'DOMAIN_CLAIMABLE' });
      const { POST } = await import('@/app/api/shops/route');

      const response = await POST(call('http://localhost/api/shops', 'POST', { name: 'My Store', domain: 'www.example.com' }));

      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('DOMAIN_CLAIMABLE');
    });
  });
});
