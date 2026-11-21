import { fetchShopProfile, setAppMetafields, ShopifyApiError } from '@/services/external/shopify/admin';
import * as repo from '@/services/repositories/shopify';
import { CreditService } from './credit';
import { ShopService } from './shop';
import { ShopifyService } from './shopify';

jest.mock('@/services/external/shopify/admin', () => ({
  fetchShopProfile: jest.fn(),
  setAppMetafields: jest.fn(),
  ShopifyApiError: class extends Error {},
}));
jest.mock('@/services/repositories/shopify');
jest.mock('./credit', () => ({ CreditService: { getUserCredits: jest.fn() } }));
jest.mock('./shop', () => ({ ...jest.requireActual('./shop'), ShopService: { usage: jest.fn(), update: jest.fn() } }));
jest.mock('@/lib/storefront/public-key', () => ({ generatePublicKey: () => 'pk_live_new' }));

const r = repo as jest.Mocked<typeof repo>;
const profileMock = fetchShopProfile as jest.Mock;

const SHOP = 'my-store.myshopify.com';
const CONFIG = { clientId: 'id', clientSecret: 'secret' };
const input = { shop: SHOP, sessionToken: 'jwt', config: CONFIG };
const row = { id: 'shop-1', publicKey: 'pk_live_old', domain: SHOP, name: 'My Store', status: 'ACTIVE', ownerId: 9 };
const profile = { name: 'My Store', contactEmail: 'owner@example.com', primaryOrigin: 'https://www.example.com' };

describe('ShopifyService.ensureInstalled', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    profileMock.mockResolvedValue(profile);
  });

  test('answers an installed shop straight from the database, without calling Shopify', async () => {
    r.findShopifyShop.mockResolvedValue(row as never);

    const result = await ShopifyService.ensureInstalled(input);

    expect(result).toEqual({ ok: true, shop: { id: 'shop-1', publicKey: 'pk_live_old', domain: SHOP, name: 'My Store', status: 'ACTIVE' } });
    expect(profileMock).not.toHaveBeenCalled();
  });

  test('sets up a new shop on first visit: its own address and primary domain are allowed, Shopify images are trusted', async () => {
    r.findShopifyShop.mockResolvedValue(null);
    r.createShopifyShopWithOwner.mockResolvedValue({ ...row, publicKey: 'pk_live_new' } as never);

    const result = await ShopifyService.ensureInstalled(input);

    expect(result.ok && result.shop.publicKey).toBe('pk_live_new');
    expect(r.createShopifyShopWithOwner).toHaveBeenCalledWith({
      domain: SHOP,
      name: 'My Store',
      contactEmail: 'owner@example.com',
      publicKey: 'pk_live_new',
      allowedOrigins: [`https://${SHOP}`, 'https://www.example.com'],
      imageHosts: ['cdn.shopify.com'],
    });
  });

  test('allows just the store address when it has no custom domain', async () => {
    r.findShopifyShop.mockResolvedValue(null);
    r.createShopifyShopWithOwner.mockResolvedValue(row as never);
    profileMock.mockResolvedValue({ ...profile, primaryOrigin: null });

    await ShopifyService.ensureInstalled(input);

    expect(r.createShopifyShopWithOwner).toHaveBeenCalledWith(expect.objectContaining({ allowedOrigins: [`https://${SHOP}`] }));
  });

  test('brings a returning merchant back with the same public key', async () => {
    r.findShopifyShop.mockResolvedValue({ ...row, status: 'UNINSTALLED' } as never);
    r.reactivateShopifyShop.mockResolvedValue(row as never);

    const result = await ShopifyService.ensureInstalled(input);

    expect(result.ok && result.shop.publicKey).toBe('pk_live_old');
    expect(r.reactivateShopifyShop).toHaveBeenCalledWith('shop-1', {
      name: 'My Store',
      contactEmail: 'owner@example.com',
      allowedOrigins: [`https://${SHOP}`, 'https://www.example.com'],
      status: 'ACTIVE',
    });
    expect(r.createShopifyShopWithOwner).not.toHaveBeenCalled();
  });

  test.each(['SUSPENDED', 'PAUSED'])('a %s shop that was uninstalled and reinstalled keeps its status, so uninstalling cannot lift a suspension', async status => {
    r.findShopifyShop.mockResolvedValue({ ...row, status, uninstalledAt: new Date() } as never);
    r.reactivateShopifyShop.mockResolvedValue({ ...row, status } as never);

    await ShopifyService.ensureInstalled(input);

    expect(r.reactivateShopifyShop).toHaveBeenCalledWith('shop-1', expect.objectContaining({ status }));
  });

  test('a shop stamped as uninstalled is not answered from the database even if its status was kept', async () => {
    r.findShopifyShop.mockResolvedValue({ ...row, status: 'SUSPENDED', uninstalledAt: new Date() } as never);
    r.reactivateShopifyShop.mockResolvedValue({ ...row, status: 'SUSPENDED' } as never);

    await ShopifyService.ensureInstalled(input);

    expect(profileMock).toHaveBeenCalled();
    expect(r.reactivateShopifyShop).toHaveBeenCalled();
  });

  test('two first requests at once end with the same shop instead of an error', async () => {
    r.findShopifyShop.mockResolvedValueOnce(null).mockResolvedValueOnce(row as never);
    r.createShopifyShopWithOwner.mockRejectedValue({ code: 'P2002', meta: { target: ['platform', 'domain'] } });

    const result = await ShopifyService.ensureInstalled(input);

    expect(result.ok && result.shop.id).toBe('shop-1');
  });

  test('reports a Shopify failure without creating anything', async () => {
    r.findShopifyShop.mockResolvedValue(null);
    profileMock.mockRejectedValue(new ShopifyApiError('refused'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await ShopifyService.ensureInstalled(input);

    expect(result).toEqual({ ok: false, reason: 'SHOPIFY_ERROR' });
    expect(r.createShopifyShopWithOwner).not.toHaveBeenCalled();
  });

  test('does not hide a bug that is not a Shopify failure', async () => {
    r.findShopifyShop.mockResolvedValue(null);
    profileMock.mockRejectedValue(new TypeError('bug'));

    await expect(ShopifyService.ensureInstalled(input)).rejects.toThrow(TypeError);
  });
});

describe('ShopifyService uninstall and erase', () => {
  beforeEach(() => jest.resetAllMocks());

  test('uninstall marks the shop', async () => {
    await ShopifyService.markUninstalled(SHOP);
    expect(r.markShopifyShopUninstalled).toHaveBeenCalledWith(SHOP);
  });

  test('erase removes the shop', async () => {
    await ShopifyService.erase(SHOP);
    expect(r.eraseShopifyShop).toHaveBeenCalledWith(SHOP);
  });
});

describe('ShopifyService.overview', () => {
  const usage = { days: 30, conversion: { opened: 1 } };

  beforeEach(() => {
    jest.resetAllMocks();
    r.findShopifyShop.mockResolvedValue(row as never);
    (CreditService.getUserCredits as jest.Mock).mockResolvedValue(12.5);
    (ShopService.usage as jest.Mock).mockResolvedValue({ ok: true, usage });
  });

  test("returns the shop, the owner's credits and the usage for the window", async () => {
    const result = await ShopifyService.overview({ ...input, days: 30 });

    expect(result).toEqual({
      ok: true,
      overview: { shop: { id: 'shop-1', publicKey: 'pk_live_old', domain: SHOP, name: 'My Store', status: 'ACTIVE' }, credits: 12.5, usage },
    });
    expect(CreditService.getUserCredits).toHaveBeenCalledWith(9);
    expect(ShopService.usage).toHaveBeenCalledWith(9, 'shop-1', 30);
  });

  test('never exposes the owner account id', async () => {
    const result = await ShopifyService.overview({ ...input, days: 30 });

    expect(JSON.stringify(result)).not.toContain('ownerId');
  });

  test('passes on a Shopify failure when the shop is not set up yet', async () => {
    r.findShopifyShop.mockResolvedValue(null);
    profileMock.mockRejectedValue(new ShopifyApiError('refused'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(ShopifyService.overview({ ...input, days: 30 })).resolves.toEqual({ ok: false, reason: 'SHOPIFY_ERROR' });
  });
});

describe('ShopifyService.setLive', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    r.findShopifyShop.mockResolvedValue(row as never);
  });

  test("switches the shop through the owner's own rules", async () => {
    (ShopService.update as jest.Mock).mockResolvedValue({ ok: true, shop: { ...row, status: 'PAUSED' } });

    const result = await ShopifyService.setLive(SHOP, 'PAUSED');

    expect(result).toMatchObject({ ok: true, shop: { id: 'shop-1', status: 'PAUSED' } });
    expect(ShopService.update).toHaveBeenCalledWith(9, 'shop-1', { status: 'PAUSED' });
  });

  test('says NOT_FOUND for a shop that is not installed', async () => {
    r.findShopifyShop.mockResolvedValue(null);

    await expect(ShopifyService.setLive(SHOP, 'ACTIVE')).resolves.toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(ShopService.update).not.toHaveBeenCalled();
  });

  test('passes on LOCKED for a suspended or uninstalled shop', async () => {
    (ShopService.update as jest.Mock).mockResolvedValue({ ok: false, reason: 'LOCKED' });

    await expect(ShopifyService.setLive(SHOP, 'ACTIVE')).resolves.toEqual({ ok: false, reason: 'LOCKED' });
  });
});

describe('ShopifyService.syncStorefrontConfig', () => {
  const metafieldsMock = setAppMetafields as jest.Mock;
  const KEY = 'pk_live_0123456789abcdef0123456789abcdef';
  const APP = 'https://app.mirrae.test';
  let counter = 0;
  // Each test uses its own shop: the throttle remembers shops between calls
  const sync = (overrides: Partial<Parameters<typeof ShopifyService.syncStorefrontConfig>[0]> = {}) =>
    ShopifyService.syncStorefrontConfig({ shop: `sync-${counter}.myshopify.com`, sessionToken: 'jwt', config: CONFIG, publicKey: KEY, appUrl: APP, ...overrides });

  beforeEach(() => {
    jest.resetAllMocks();
    counter += 1;
  });

  test('stores the shop key and the widget address for the theme extension', async () => {
    expect(await sync()).toBe('SYNCED');

    expect(metafieldsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metafields: [
          expect.objectContaining({ key: 'public_key', value: KEY }),
          expect.objectContaining({ key: 'widget_url', value: `${APP}/widget.js` }),
        ],
      })
    );
  });

  test('does not repeat the work on the next page load within the hour, but does again later', async () => {
    const shop = `repeat-${counter}.myshopify.com`;
    const t0 = 1_800_000_000_000;

    expect(await sync({ shop, now: t0 })).toBe('SYNCED');
    expect(await sync({ shop, now: t0 + 30 * 60 * 1000 })).toBe('SKIPPED');
    expect(await sync({ shop, now: t0 + 61 * 60 * 1000 })).toBe('SYNCED');
    expect(metafieldsMock).toHaveBeenCalledTimes(2);
  });

  test('retries a failure after a few minutes, not on every page load, and never throws for a Shopify failure', async () => {
    const shop = `fail-${counter}.myshopify.com`;
    const t0 = 1_800_000_000_000;
    metafieldsMock.mockRejectedValueOnce(new ShopifyApiError('refused'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await sync({ shop, now: t0 })).toBe('FAILED');
    expect(await sync({ shop, now: t0 + 60 * 1000 })).toBe('SKIPPED');
    expect(await sync({ shop, now: t0 + 6 * 60 * 1000 })).toBe('SYNCED');
  });

  test('does nothing when the app address is not https (a store page could not load the script)', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await sync({ appUrl: 'http://localhost:3000' })).toBe('SKIPPED');
    expect(metafieldsMock).not.toHaveBeenCalled();
  });

  test('does not hide a bug that is not a Shopify failure', async () => {
    metafieldsMock.mockRejectedValueOnce(new TypeError('bug'));

    await expect(sync()).rejects.toThrow(TypeError);
  });
});
