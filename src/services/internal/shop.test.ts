import { generatePublicKey } from '@/lib/storefront/public-key';
import * as repo from '@/services/repositories/shop';
import * as eventRepo from '@/services/repositories/storefront-event';
import { MAX_SHOPS_PER_OWNER, ShopService } from './shop';

jest.mock('@/services/repositories/shop');
jest.mock('@/services/repositories/storefront-event');
jest.mock('@/lib/storefront/public-key', () => ({ generatePublicKey: jest.fn() }));

const r = repo as jest.Mocked<typeof repo>;
const events = eventRepo as jest.Mocked<typeof eventRepo>;
const keyMock = generatePublicKey as jest.Mock;

const OWNER = 7;
const shop = {
  id: '8a1f0c52-1111-4222-8333-444455556666',
  ownerId: OWNER,
  name: 'My Store',
  platform: 'WEB',
  domain: 'www.example.com',
  publicKey: 'pk_live_aaa',
  allowedOrigins: ['https://www.example.com'],
  imageHosts: [],
  status: 'ACTIVE',
  dailyTryOnCap: 200,
  createdAt: new Date('2026-11-14T00:00:00Z'),
  updatedAt: new Date('2026-11-14T00:00:00Z'),
};

describe('ShopService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    keyMock.mockReturnValue('pk_live_new');
  });

  describe('create', () => {
    const input = { name: 'My Store', domain: 'www.example.com', allowedOrigins: ['https://www.example.com', 'https://example.com'], imageHosts: [] };

    test('creates a web shop owned by the merchant with a fresh public key', async () => {
      r.countShopsByOwner.mockResolvedValue(0);
      r.createShop.mockResolvedValue(shop as never);

      const result = await ShopService.create(OWNER, input);

      expect(result).toEqual({ ok: true, shop: expect.objectContaining({ id: shop.id }) });
      expect(r.createShop).toHaveBeenCalledWith({
        ownerId: OWNER,
        name: 'My Store',
        platform: 'WEB',
        domain: 'www.example.com',
        publicKey: 'pk_live_new',
        allowedOrigins: input.allowedOrigins,
        imageHosts: [],
      });
    });

    test(`refuses a sixth shop (limit ${MAX_SHOPS_PER_OWNER}) so one account cannot hoard domains`, async () => {
      r.countShopsByOwner.mockResolvedValue(MAX_SHOPS_PER_OWNER);

      await expect(ShopService.create(OWNER, input)).resolves.toEqual({ ok: false, reason: 'LIMIT_REACHED' });
      expect(r.createShop).not.toHaveBeenCalled();
    });

    test('says the domain is taken when another shop already has it', async () => {
      r.countShopsByOwner.mockResolvedValue(0);
      r.createShop.mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['platform', 'domain'] } }));

      await expect(ShopService.create(OWNER, input)).resolves.toEqual({ ok: false, reason: 'DOMAIN_TAKEN' });
    });

    test('recognises a taken domain in the shape the real database driver reports (no meta.target)', async () => {
      r.countShopsByOwner.mockResolvedValue(0);
      r.createShop.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed on the fields: (`platform`, `domain`)'), {
          code: 'P2002',
          meta: {
            modelName: 'Shop',
            driverAdapterError: {
              cause: { kind: 'UniqueConstraintViolation', originalMessage: 'duplicate key value violates unique constraint "Shop_platform_domain_key"', constraint: { fields: ['platform', 'domain'] } },
            },
          },
        })
      );

      await expect(ShopService.create(OWNER, input)).resolves.toEqual({ ok: false, reason: 'DOMAIN_TAKEN' });
    });

    test('recognises a public key clash in the real driver shape (the field name arrives quoted) and retries', async () => {
      r.countShopsByOwner.mockResolvedValue(0);
      r.createShop
        .mockRejectedValueOnce(
          Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
            meta: { driverAdapterError: { cause: { originalMessage: 'duplicate key ... "Shop_publicKey_key"', constraint: { fields: ['"publicKey"'] } } } },
          })
        )
        .mockResolvedValueOnce(shop as never);

      await expect(ShopService.create(OWNER, input)).resolves.toMatchObject({ ok: true });
      expect(r.createShop).toHaveBeenCalledTimes(2);
    });

    test('a unique violation on some other field is not mistaken for a taken domain', async () => {
      r.countShopsByOwner.mockResolvedValue(0);
      r.createShop.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2002', meta: { target: ['somethingElse'] } }));

      await expect(ShopService.create(OWNER, input)).rejects.toThrow();
    });

    test('tries a new public key once if the generated one is already in use, then gives up', async () => {
      r.countShopsByOwner.mockResolvedValue(0);
      keyMock.mockReturnValueOnce('pk_live_dup').mockReturnValueOnce('pk_live_fresh');
      r.createShop
        .mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['publicKey'] } }))
        .mockResolvedValueOnce(shop as never);

      await expect(ShopService.create(OWNER, input)).resolves.toMatchObject({ ok: true });
      expect(r.createShop).toHaveBeenCalledTimes(2);
      expect(r.createShop.mock.calls[1][0].publicKey).toBe('pk_live_fresh');
    });

    test('lets any other database error through instead of hiding it', async () => {
      r.countShopsByOwner.mockResolvedValue(0);
      r.createShop.mockRejectedValue(new Error('connection lost'));

      await expect(ShopService.create(OWNER, input)).rejects.toThrow('connection lost');
    });
  });

  describe('list', () => {
    test("returns the merchant's shops with how many try-ons each had in the last 7 days", async () => {
      r.listShopsByOwner.mockResolvedValue([shop, { ...shop, id: 'shop-2' }] as never);
      r.countJobsByShopSince.mockResolvedValue(new Map([[shop.id, 12]]));

      const shops = await ShopService.list(OWNER);

      expect(shops.map(item => [item.id, item.tryOnsLast7Days])).toEqual([[shop.id, 12], ['shop-2', 0]]);
    });

    test('does not ask for activity when there are no shops', async () => {
      r.listShopsByOwner.mockResolvedValue([]);

      await expect(ShopService.list(OWNER)).resolves.toEqual([]);
      expect(r.countJobsByShopSince).not.toHaveBeenCalled();
    });

    test('never exposes the owner id', async () => {
      r.listShopsByOwner.mockResolvedValue([shop] as never);
      r.countJobsByShopSince.mockResolvedValue(new Map());

      const [item] = await ShopService.list(OWNER);

      expect(item).not.toHaveProperty('ownerId');
    });
  });

  describe('get', () => {
    test("returns the merchant's own shop", async () => {
      r.findShopByIdForOwner.mockResolvedValue(shop as never);

      await expect(ShopService.get(OWNER, shop.id)).resolves.toMatchObject({ id: shop.id, publicKey: 'pk_live_aaa' });
      expect(r.findShopByIdForOwner).toHaveBeenCalledWith(shop.id, OWNER);
    });

    test('returns null for a shop that belongs to someone else (or does not exist)', async () => {
      r.findShopByIdForOwner.mockResolvedValue(null);

      await expect(ShopService.get(OWNER, 'someone-elses')).resolves.toBeNull();
    });
  });

  describe('update', () => {
    test('saves the changes the merchant made', async () => {
      r.findShopByIdForOwner.mockResolvedValue(shop as never);
      r.updateShop.mockResolvedValue({ ...shop, dailyTryOnCap: 50 } as never);

      const result = await ShopService.update(OWNER, shop.id, { dailyTryOnCap: 50 });

      expect(result).toMatchObject({ ok: true, shop: { dailyTryOnCap: 50 } });
      expect(r.updateShop).toHaveBeenCalledWith(shop.id, { dailyTryOnCap: 50 });
    });

    test('says NOT_FOUND for someone else\'s shop and changes nothing', async () => {
      r.findShopByIdForOwner.mockResolvedValue(null);

      await expect(ShopService.update(OWNER, 'x', { name: 'Hijack' })).resolves.toEqual({ ok: false, reason: 'NOT_FOUND' });
      expect(r.updateShop).not.toHaveBeenCalled();
    });

    test.each(['SUSPENDED', 'UNINSTALLED'])('a %s shop cannot be re-activated or paused by the merchant', async status => {
      r.findShopByIdForOwner.mockResolvedValue({ ...shop, status } as never);

      await expect(ShopService.update(OWNER, shop.id, { status: 'ACTIVE' })).resolves.toEqual({ ok: false, reason: 'LOCKED' });
      expect(r.updateShop).not.toHaveBeenCalled();
    });

    test('a suspended shop can still have its name and settings edited, just not its status', async () => {
      r.findShopByIdForOwner.mockResolvedValue({ ...shop, status: 'SUSPENDED' } as never);
      r.updateShop.mockResolvedValue({ ...shop, status: 'SUSPENDED', name: 'Renamed' } as never);

      await expect(ShopService.update(OWNER, shop.id, { name: 'Renamed' })).resolves.toMatchObject({ ok: true });
    });

    test('pauses and resumes', async () => {
      r.findShopByIdForOwner.mockResolvedValue(shop as never);
      r.updateShop.mockResolvedValue({ ...shop, status: 'PAUSED' } as never);

      await expect(ShopService.update(OWNER, shop.id, { status: 'PAUSED' })).resolves.toMatchObject({ ok: true, shop: { status: 'PAUSED' } });
    });
  });

  describe('rotateKey', () => {
    test('gives the shop a new public key, so a leaked or abused key stops working', async () => {
      r.findShopByIdForOwner.mockResolvedValue(shop as never);
      r.updateShop.mockResolvedValue({ ...shop, publicKey: 'pk_live_new' } as never);

      const result = await ShopService.rotateKey(OWNER, shop.id);

      expect(result).toMatchObject({ ok: true, shop: { publicKey: 'pk_live_new' } });
      expect(r.updateShop).toHaveBeenCalledWith(shop.id, { publicKey: 'pk_live_new' });
    });

    test('says NOT_FOUND for someone else\'s shop', async () => {
      r.findShopByIdForOwner.mockResolvedValue(null);

      await expect(ShopService.rotateKey(OWNER, 'x')).resolves.toEqual({ ok: false, reason: 'NOT_FOUND' });
      expect(r.updateShop).not.toHaveBeenCalled();
    });
  });

  describe('usage', () => {
    const now = new Date('2026-11-14T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
      r.findShopByIdForOwner.mockResolvedValue(shop as never);
      r.countShopJobsSince.mockResolvedValue(9);
      events.countSessionsByEventType.mockResolvedValue({ WIDGET_OPENED: 40, RESULT_VIEWED: 20, ADD_TO_CART: 5, SHARED: 3 });
      r.getShopUsage.mockResolvedValue({
        statusCounts: { QUEUED: 1, PROCESSING: 1, DONE: 20, FAILED: 4 },
        failureCodes: [
          { code: 'NO_PERSON', count: 2 },
          { code: 'Try-on failed. You have not been charged.', count: 2 },
        ],
        creditsSpent: 31,
        recent: [{ id: 'j1', status: 'DONE', viewCount: 3, createdAt: new Date('2026-11-14T10:00:00Z'), chargedAt: new Date(), error: null }],
      });
    });

    afterEach(() => jest.useRealTimers());

    test('reports conversion as counts of shopper sessions, with add-to-cart as a share of those who saw a result', async () => {
      const result = await ShopService.usage(OWNER, shop.id, 30);

      expect(result.ok && result.usage.conversion).toEqual({ opened: 40, sawResult: 20, addedToCart: 5, shared: 3, addToCartRate: 0.25 });
    });

    test('has no add-to-cart rate until someone has seen a result', async () => {
      events.countSessionsByEventType.mockResolvedValue({ WIDGET_OPENED: 3, RESULT_VIEWED: 0, ADD_TO_CART: 0, SHARED: 0 });

      const result = await ShopService.usage(OWNER, shop.id, 30);

      expect(result.ok && result.usage.conversion.addToCartRate).toBeNull();
    });

    test('summarises the window: totals by outcome, credits spent, today against the cap', async () => {
      const result = await ShopService.usage(OWNER, shop.id, 30);

      expect(result).toMatchObject({
        ok: true,
        usage: {
          days: 30,
          jobs: { total: 26, done: 20, failed: 4, inProgress: 2 },
          creditsSpent: 31,
          startedToday: 9,
          dailyTryOnCap: 200,
        },
      });
    });

    test('looks back exactly the number of days asked for', async () => {
      await ShopService.usage(OWNER, shop.id, 7);

      const since = r.getShopUsage.mock.calls[0][1];
      expect(now.getTime() - since.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    test('names photo problems and lumps every other failure together, never exposing raw error text', async () => {
      const result = await ShopService.usage(OWNER, shop.id, 30);

      expect(result.ok && result.usage.failureReasons).toEqual([
        { code: 'NO_PERSON', count: 2 },
        { code: 'OTHER', count: 2 },
      ]);
    });

    test('lists recent try-ons without any image or storage key', async () => {
      const result = await ShopService.usage(OWNER, shop.id, 30);

      expect(result.ok && result.usage.recent[0]).toEqual({
        id: 'j1',
        status: 'DONE',
        viewCount: 3,
        createdAt: new Date('2026-11-14T10:00:00Z'),
        charged: true,
        failureCode: null,
      });
    });

    test('says NOT_FOUND for someone else\'s shop and reads no usage', async () => {
      r.findShopByIdForOwner.mockResolvedValue(null);

      await expect(ShopService.usage(OWNER, 'x', 30)).resolves.toEqual({ ok: false, reason: 'NOT_FOUND' });
      expect(r.getShopUsage).not.toHaveBeenCalled();
    });
  });
});
