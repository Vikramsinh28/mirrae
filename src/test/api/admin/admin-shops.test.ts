/**
 * Route-handler tests for the admin overview and shop APIs. The service is mocked; these check the HTTP layer:
 * only admins get in, input is validated, and shop changes are limited to what an admin may do.
 */
import { NextRequest } from 'next/server';

import { getAuthUser } from '@/lib/auth/jwt';
import { AdminService } from '@/services/internal/admin';
import { getUserById } from '@/services/repositories/user';

jest.mock('@/lib/auth/jwt', () => ({ getAuthUser: jest.fn(), JWT_KEY: 'auth-token' }));
jest.mock('@/services/repositories/user', () => ({ getUserById: jest.fn() }));
jest.mock('@/services/internal/admin', () => ({
  AdminService: { overview: jest.fn(), listShops: jest.fn(), setShopStatus: jest.fn(), shopDetail: jest.fn(), adjustCredits: jest.fn() },
}));

const auth = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const userById = getUserById as jest.MockedFunction<typeof getUserById>;
const service = AdminService as jest.Mocked<typeof AdminService>;

const SHOP_ID = '8a1f0c52-1111-4222-8333-444455556666';

function signInAs(role: 'ADMIN' | 'USER' | null) {
  auth.mockResolvedValue((role ? { userId: 1 } : null) as never);
  userById.mockResolvedValue((role ? { id: 1, email: 'a@example.com', role } : null) as never);
}

const call = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

describe('Admin API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signInAs('ADMIN');
  });

  describe.each([
    ['GET /api/admin/stats', async () => (await import('@/app/api/admin/stats/route')).GET(call('http://localhost/api/admin/stats'))],
    ['GET /api/admin/shops', async () => (await import('@/app/api/admin/shops/route')).GET(call('http://localhost/api/admin/shops'))],
    [
      'GET /api/admin/shops/[id]',
      async () => (await import('@/app/api/admin/shops/[id]/route')).GET(call(`http://localhost/api/admin/shops/${SHOP_ID}`), { params: Promise.resolve({ id: SHOP_ID }) }),
    ],
    [
      'POST /api/admin/shops/[id]/credits',
      async () =>
        (await import('@/app/api/admin/shops/[id]/credits/route')).POST(call(`http://localhost/api/admin/shops/${SHOP_ID}/credits`, 'POST', { amount: 5, reason: 'Test credit' }), {
          params: Promise.resolve({ id: SHOP_ID }),
        }),
    ],
    [
      'PATCH /api/admin/shops/[id]',
      async () => (await import('@/app/api/admin/shops/[id]/route')).PATCH(call(`http://localhost/api/admin/shops/${SHOP_ID}`, 'PATCH', { status: 'SUSPENDED' }), {
        params: Promise.resolve({ id: SHOP_ID }),
      }),
    ],
  ])('%s', (_name, run) => {
    test('refuses someone who is not signed in', async () => {
      signInAs(null);

      expect((await run()).status).toBe(401);
      expect(service.overview).not.toHaveBeenCalled();
      expect(service.listShops).not.toHaveBeenCalled();
      expect(service.setShopStatus).not.toHaveBeenCalled();
      expect(service.shopDetail).not.toHaveBeenCalled();
      expect(service.adjustCredits).not.toHaveBeenCalled();
    });

    test('refuses a merchant who is not an admin', async () => {
      signInAs('USER');

      expect((await run()).status).toBe(403);
      expect(service.overview).not.toHaveBeenCalled();
      expect(service.listShops).not.toHaveBeenCalled();
      expect(service.setShopStatus).not.toHaveBeenCalled();
      expect(service.shopDetail).not.toHaveBeenCalled();
      expect(service.adjustCredits).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/stats', () => {
    const get = async (query = '') => (await import('@/app/api/admin/stats/route')).GET(call(`http://localhost/api/admin/stats${query}`));

    test('returns the overview for the window', async () => {
      service.overview.mockResolvedValue({ days: 30 } as never);

      const response = await get('?days=30');

      expect(response.status).toBe(200);
      expect(service.overview).toHaveBeenCalledWith(30);
    });

    test('rejects a bad window', async () => {
      expect((await get('?days=abc')).status).toBe(400);
      expect(service.overview).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/shops', () => {
    const get = async (query = '') => (await import('@/app/api/admin/shops/route')).GET(call(`http://localhost/api/admin/shops${query}`));

    test('passes the filters on', async () => {
      service.listShops.mockResolvedValue({ total: 0, shops: [] } as never);

      const response = await get('?search=store&status=SUSPENDED&platform=SHOPIFY&limit=10&offset=20');

      expect(response.status).toBe(200);
      expect(service.listShops).toHaveBeenCalledWith({ search: 'store', status: 'SUSPENDED', platform: 'SHOPIFY', limit: 10, offset: 20 });
    });

    test.each(['?status=DELETED', '?limit=1000', '?offset=-1'])('rejects %s', async query => {
      expect((await get(query)).status).toBe(400);
      expect(service.listShops).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/shops/[id]', () => {
    const patch = async (body: unknown, id = SHOP_ID) =>
      (await import('@/app/api/admin/shops/[id]/route')).PATCH(call(`http://localhost/api/admin/shops/${id}`, 'PATCH', body), { params: Promise.resolve({ id }) });

    test.each(['SUSPENDED', 'ACTIVE'])('sets the status to %s', async status => {
      service.setShopStatus.mockResolvedValue({ ok: true, status });

      const response = await patch({ status });

      expect(response.status).toBe(200);
      expect(service.setShopStatus).toHaveBeenCalledWith(1, SHOP_ID, status);
    });

    test.each([{ status: 'PAUSED' }, { status: 'UNINSTALLED' }, { status: 'DELETED' }, {}, null])('refuses %p', async body => {
      expect((await patch(body)).status).toBe(400);
      expect(service.setShopStatus).not.toHaveBeenCalled();
    });

    test('says 404 for an id that is not a uuid, without touching the database', async () => {
      expect((await patch({ status: 'SUSPENDED' }, 'not-a-uuid')).status).toBe(404);
      expect(service.setShopStatus).not.toHaveBeenCalled();
    });

    test('maps an unknown shop to 404 and an uninstalled one to 409', async () => {
      service.setShopStatus.mockResolvedValueOnce({ ok: false, reason: 'NOT_FOUND' }).mockResolvedValueOnce({ ok: false, reason: 'LOCKED' });

      expect((await patch({ status: 'ACTIVE' })).status).toBe(404);
      expect((await patch({ status: 'ACTIVE' })).status).toBe(409);
    });
  });

  describe('GET /api/admin/shops/[id]', () => {
    const get = async (query = '', id = SHOP_ID) =>
      (await import('@/app/api/admin/shops/[id]/route')).GET(call(`http://localhost/api/admin/shops/${id}${query}`), { params: Promise.resolve({ id }) });

    test('returns the shop detail for the window', async () => {
      service.shopDetail.mockResolvedValue({ ok: true, detail: { shop: { id: SHOP_ID } } } as never);

      const response = await get('?days=30');

      expect(response.status).toBe(200);
      expect(service.shopDetail).toHaveBeenCalledWith(SHOP_ID, 30);
    });

    test('answers 404 for an unknown shop or an id that is not a uuid, and 400 for a bad window', async () => {
      service.shopDetail.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });

      expect((await get()).status).toBe(404);
      expect((await get('', 'nope')).status).toBe(404);
      expect((await get('?days=abc')).status).toBe(400);
    });
  });

  describe('POST /api/admin/shops/[id]/credits', () => {
    const post = async (body: unknown, id = SHOP_ID) =>
      (await import('@/app/api/admin/shops/[id]/credits/route')).POST(call(`http://localhost/api/admin/shops/${id}/credits`, 'POST', body), { params: Promise.resolve({ id }) });

    test('adjusts the credits as the signed-in admin, with the reason', async () => {
      service.adjustCredits.mockResolvedValue({ ok: true, balance: 55 });

      const response = await post({ amount: 50, reason: 'Goodwill' });

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ balance: 55 });
      expect(service.adjustCredits).toHaveBeenCalledWith(1, SHOP_ID, { amount: 50, reason: 'Goodwill' });
    });

    test.each([{}, { amount: 0, reason: 'zero' }, { amount: 50 }, { amount: 50, reason: '' }, { amount: 99999, reason: 'too much' }, { amount: 'a lot', reason: 'text' }, null])(
      'rejects %p without changing anything',
      async body => {
        expect((await post(body)).status).toBe(400);
        expect(service.adjustCredits).not.toHaveBeenCalled();
      }
    );

    test('answers 404 for an unknown shop and 409 when a removal would go below zero', async () => {
      service.adjustCredits.mockResolvedValueOnce({ ok: false, reason: 'NOT_FOUND' }).mockResolvedValueOnce({ ok: false, reason: 'INSUFFICIENT' });

      expect((await post({ amount: 5, reason: 'Test' })).status).toBe(404);
      expect((await post({ amount: -500, reason: 'Clawback' })).status).toBe(409);
    });
  });
});
