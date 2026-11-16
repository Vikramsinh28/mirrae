import * as adminRepo from '@/services/repositories/admin';
import * as shopRepo from '@/services/repositories/shop';
import { AdminService } from './admin';

jest.mock('@/services/repositories/admin');
jest.mock('@/services/repositories/shop');

const admin = adminRepo as jest.Mocked<typeof adminRepo>;
const shops = shopRepo as jest.Mocked<typeof shopRepo>;

const rawStats = {
  shopsByStatus: { ACTIVE: 4, SUSPENDED: 1 },
  shopsByPlatform: { WEB: 3, SHOPIFY: 2 },
  newShops: 2,
  merchants: 5,
  jobsByStatus: { DONE: 18, FAILED: 2, QUEUED: 1 },
  jobsToday: 6,
  failureCodes: [
    { code: 'NO_PERSON', count: 1 },
    { code: 'Vertex exploded: internal detail', count: 1 },
  ],
  creditsSpent: 31,
  sessionsByEvent: { WIDGET_OPENED: 20, RESULT_VIEWED: 10, ADD_TO_CART: 4 },
  shopifyCharges: [
    { test: true, charges: 3, revenue: 27 },
    { test: false, charges: 1, revenue: 29 },
  ],
  outOfCredits: [],
  highFailure: [{ id: 's1', name: 'Shaky Store', domain: 'shaky.example.com', total: 20, failed: 8 }],
};

describe('AdminService.overview', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    admin.getPlatformStats.mockResolvedValue(rawStats as never);
  });

  test('summarises the window: jobs, success rate, credits, conversion and real revenue', async () => {
    const result = await AdminService.overview(7);

    expect(result.jobs).toEqual({ total: 21, done: 18, failed: 2, inProgress: 1, successRate: 0.9, startedToday: 6 });
    expect(result.creditsSpent).toBe(31);
    expect(result.conversion).toEqual({ opened: 20, sawResult: 10, addedToCart: 4, shared: 0 });
    // Test charges never count as revenue
    expect(result.shopify).toEqual({ liveCharges: 1, liveRevenueUsd: 29, testCharges: 3 });
  });

  test('has no success rate until something has finished', async () => {
    admin.getPlatformStats.mockResolvedValue({ ...rawStats, jobsByStatus: { QUEUED: 2 } } as never);

    expect((await AdminService.overview(7)).jobs.successRate).toBeNull();
  });

  test('keeps named photo problems and lumps every other failure, so internal wording never reaches a screen', async () => {
    const result = await AdminService.overview(7);

    expect(result.failureReasons).toEqual([
      { code: 'NO_PERSON', count: 1 },
      { code: 'OTHER', count: 1 },
    ]);
  });

  test('flags shops that fail a lot, with their failure rate', async () => {
    const result = await AdminService.overview(7);

    expect(result.attention.highFailure).toEqual([{ id: 's1', name: 'Shaky Store', domain: 'shaky.example.com', total: 20, failed: 8, failureRate: 0.4 }]);
  });

  test('asks the database for the window and for today in UTC', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-16T15:30:00Z'));

    await AdminService.overview(7);

    expect(admin.getPlatformStats).toHaveBeenCalledWith(new Date('2026-11-09T15:30:00Z'), new Date('2026-11-16T00:00:00Z'));
    jest.useRealTimers();
  });
});

describe('AdminService.listShops', () => {
  beforeEach(() => jest.resetAllMocks());

  test('adds how many try-ons each shop started in the last 7 days', async () => {
    const query = { limit: 25, offset: 0 } as never;
    admin.listShopsForAdmin.mockResolvedValue({
      total: 2,
      shops: [
        { id: 'a', name: 'A', domain: 'a.example.com', platform: 'WEB', status: 'ACTIVE', owner: { email: 'a@example.com', credits: 3 } },
        { id: 'b', name: 'B', domain: 'b.myshopify.com', platform: 'SHOPIFY', status: 'SUSPENDED', owner: { email: 'x@shops.invalid', credits: 0 } },
      ],
    } as never);
    shops.countJobsByShopSince.mockResolvedValue(new Map([['a', 12]]));

    const result = await AdminService.listShops(query);

    expect(result.total).toBe(2);
    expect(result.shops.map(shop => [shop.id, shop.tryOnsLast7Days])).toEqual([
      ['a', 12],
      ['b', 0],
    ]);
  });

  test('does not look up counts for an empty page', async () => {
    admin.listShopsForAdmin.mockResolvedValue({ total: 0, shops: [] });

    await AdminService.listShops({ limit: 25, offset: 0 } as never);

    expect(shops.countJobsByShopSince).not.toHaveBeenCalled();
  });
});

describe('AdminService.setShopStatus', () => {
  beforeEach(() => jest.resetAllMocks());

  test('suspends an active shop', async () => {
    shops.findShopById.mockResolvedValue({ id: 's', status: 'ACTIVE' } as never);
    shops.updateShop.mockResolvedValue({ id: 's', status: 'SUSPENDED' } as never);

    expect(await AdminService.setShopStatus('s', 'SUSPENDED')).toEqual({ ok: true, status: 'SUSPENDED' });
    expect(shops.updateShop).toHaveBeenCalledWith('s', { status: 'SUSPENDED' });
  });

  test('lets a suspended shop back in', async () => {
    shops.findShopById.mockResolvedValue({ id: 's', status: 'SUSPENDED' } as never);
    shops.updateShop.mockResolvedValue({ id: 's', status: 'ACTIVE' } as never);

    expect(await AdminService.setShopStatus('s', 'ACTIVE')).toEqual({ ok: true, status: 'ACTIVE' });
  });

  test('never revives an uninstalled shop (only Shopify decides that)', async () => {
    shops.findShopById.mockResolvedValue({ id: 's', status: 'UNINSTALLED' } as never);

    expect(await AdminService.setShopStatus('s', 'ACTIVE')).toEqual({ ok: false, reason: 'LOCKED' });
    expect(shops.updateShop).not.toHaveBeenCalled();
  });

  test('never lifts a suspension from a shop that is uninstalled but kept its SUSPENDED status', async () => {
    shops.findShopById.mockResolvedValue({ id: 's', status: 'SUSPENDED', uninstalledAt: new Date() } as never);

    expect(await AdminService.setShopStatus('s', 'ACTIVE')).toEqual({ ok: false, reason: 'LOCKED' });
    expect(shops.updateShop).not.toHaveBeenCalled();
  });

  test('says NOT_FOUND for an unknown shop', async () => {
    shops.findShopById.mockResolvedValue(null);

    expect(await AdminService.setShopStatus('nope', 'SUSPENDED')).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });
});
