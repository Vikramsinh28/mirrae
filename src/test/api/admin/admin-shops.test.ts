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
  AdminService: { overview: jest.fn(), listShops: jest.fn(), setShopStatus: jest.fn() },
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
    });

    test('refuses a merchant who is not an admin', async () => {
      signInAs('USER');

      expect((await run()).status).toBe(403);
      expect(service.overview).not.toHaveBeenCalled();
      expect(service.listShops).not.toHaveBeenCalled();
      expect(service.setShopStatus).not.toHaveBeenCalled();
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
      expect(service.setShopStatus).toHaveBeenCalledWith(SHOP_ID, status);
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
});
