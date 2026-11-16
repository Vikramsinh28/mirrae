import { fetchShopProfile, ShopifyApiError } from '@/services/external/shopify/admin';
import * as repo from '@/services/repositories/shopify';
import { ShopifyService } from './shopify';

jest.mock('@/services/external/shopify/admin', () => ({
  fetchShopProfile: jest.fn(),
  ShopifyApiError: class extends Error {},
}));
jest.mock('@/services/repositories/shopify');
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
    });
    expect(r.createShopifyShopWithOwner).not.toHaveBeenCalled();
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
