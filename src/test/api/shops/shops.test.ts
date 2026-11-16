/**
 * Route-handler tests for the merchant shops API. The service is mocked; these check the HTTP layer:
 * login required, input validation, status codes, and that every call is scoped to the signed-in merchant.
 */
import { NextRequest } from 'next/server';

import { getAuthUser } from '@/lib/auth/jwt';
import { ShopService } from '@/services/internal/shop';
import { getUserById } from '@/services/repositories/user';

jest.mock('@/lib/auth/jwt', () => ({ getAuthUser: jest.fn(), JWT_KEY: 'auth-token' }));
jest.mock('@/services/repositories/user', () => ({ getUserById: jest.fn() }));
jest.mock('@/services/internal/shop', () => ({
  MAX_SHOPS_PER_OWNER: 5,
  ShopService: { create: jest.fn(), list: jest.fn(), get: jest.fn(), update: jest.fn(), rotateKey: jest.fn(), usage: jest.fn() },
}));

const auth = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const userById = getUserById as jest.MockedFunction<typeof getUserById>;
const service = ShopService as jest.Mocked<typeof ShopService>;

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
});
