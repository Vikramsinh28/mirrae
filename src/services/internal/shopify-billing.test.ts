import { createOneTimePurchase, listOneTimePurchases, ShopifyApiError } from '@/services/external/shopify/admin';
import * as shopifyRepo from '@/services/repositories/shopify';
import * as chargeRepo from '@/services/repositories/shopify-charge';
import { ShopifyBillingService } from './shopify-billing';

jest.mock('@/services/external/shopify/admin', () => ({
  createOneTimePurchase: jest.fn(),
  listOneTimePurchases: jest.fn(),
  ShopifyApiError: class extends Error {},
}));
jest.mock('@/services/repositories/shopify');
jest.mock('@/services/repositories/shopify-charge');

const shops = shopifyRepo as jest.Mocked<typeof shopifyRepo>;
const charges = chargeRepo as jest.Mocked<typeof chargeRepo>;
const createPurchase = createOneTimePurchase as jest.Mock;
const listPurchases = listOneTimePurchases as jest.Mock;

const SHOP = 'my-store.myshopify.com';
const CONFIG = { clientId: 'client-id', clientSecret: 'secret' };
const session = { shop: SHOP, sessionToken: 'jwt', config: CONFIG };
const row = { id: 'shop-1', domain: SHOP, status: 'ACTIVE', ownerId: 9 };
const GID = 'gid://shopify/AppPurchaseOneTime/1';

describe('ShopifyBillingService.startPurchase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    shops.findShopifyShop.mockResolvedValue(row as never);
    createPurchase.mockResolvedValue({ gid: GID, confirmationUrl: `https://${SHOP}/admin/charges/1/confirm` });
    delete process.env.SHOPIFY_BILLING_LIVE;
  });

  test('asks Shopify to bill the pack price, remembers the pending charge, and returns the approval page', async () => {
    const result = await ShopifyBillingService.startPurchase({ ...session, packId: 'pack_50' });

    expect(result).toEqual({ ok: true, confirmationUrl: `https://${SHOP}/admin/charges/1/confirm` });
    expect(createPurchase).toHaveBeenCalledWith(expect.objectContaining({ priceUsd: 9, returnUrl: `https://${SHOP}/admin/apps/client-id`, test: true }));
    expect(charges.createCharge).toHaveBeenCalledWith({ shopId: 'shop-1', shopDomain: SHOP, gid: GID, packId: 'pack_50', credits: 50, priceUsd: 9, test: true });
  });

  test('bills for real only when billing is switched to live', async () => {
    process.env.SHOPIFY_BILLING_LIVE = 'true';

    await ShopifyBillingService.startPurchase({ ...session, packId: 'pack_50' });

    expect(createPurchase).toHaveBeenCalledWith(expect.objectContaining({ test: false }));
    process.env.SHOPIFY_BILLING_LIVE = '';
  });

  test('refuses a pack that does not exist, so a client can never choose its own price', async () => {
    const result = await ShopifyBillingService.startPurchase({ ...session, packId: 'pack_free' });

    expect(result).toEqual({ ok: false, reason: 'UNKNOWN_PACK' });
    expect(createPurchase).not.toHaveBeenCalled();
  });

  test.each(['UNINSTALLED', 'SUSPENDED'])('refuses a %s shop', async status => {
    shops.findShopifyShop.mockResolvedValue({ ...row, status } as never);

    expect(await ShopifyBillingService.startPurchase({ ...session, packId: 'pack_50' })).toMatchObject({ ok: false });
    expect(createPurchase).not.toHaveBeenCalled();
  });

  test('refuses a shop that is not installed', async () => {
    shops.findShopifyShop.mockResolvedValue(null);

    expect(await ShopifyBillingService.startPurchase({ ...session, packId: 'pack_50' })).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  test('reports a Shopify failure without remembering a charge', async () => {
    createPurchase.mockRejectedValue(new ShopifyApiError('refused'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await ShopifyBillingService.startPurchase({ ...session, packId: 'pack_50' })).toEqual({ ok: false, reason: 'SHOPIFY_ERROR' });
    expect(charges.createCharge).not.toHaveBeenCalled();
  });

  test('never sends the merchant to an approval page that is not a Shopify admin address', async () => {
    createPurchase.mockResolvedValue({ gid: GID, confirmationUrl: 'https://evil.com/pay' });

    expect(await ShopifyBillingService.startPurchase({ ...session, packId: 'pack_50' })).toEqual({ ok: false, reason: 'SHOPIFY_ERROR' });
    expect(charges.createCharge).not.toHaveBeenCalled();
  });
});

describe('ShopifyBillingService.syncPurchases', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    shops.findShopifyShop.mockResolvedValue(row as never);
  });

  test('does not call Shopify when nothing is waiting for approval', async () => {
    charges.listPendingCharges.mockResolvedValue([]);

    expect(await ShopifyBillingService.syncPurchases(session)).toEqual({ ok: true, credited: 0 });
    expect(listPurchases).not.toHaveBeenCalled();
  });

  test('pays out the charges the merchant has approved and leaves the others waiting', async () => {
    charges.listPendingCharges.mockResolvedValue([{ gid: 'gid://a' }, { gid: 'gid://b' }] as never);
    listPurchases.mockResolvedValue([
      { gid: 'gid://a', status: 'ACTIVE' },
      { gid: 'gid://b', status: 'PENDING' },
    ]);
    charges.settleCharge.mockResolvedValue(50);

    const result = await ShopifyBillingService.syncPurchases(session);

    expect(result).toEqual({ ok: true, credited: 50 });
    expect(charges.settleCharge).toHaveBeenCalledTimes(1);
    expect(charges.settleCharge).toHaveBeenCalledWith('gid://a', 'ACTIVE');
  });

  test('ignores purchases it did not create and statuses it does not know', async () => {
    charges.listPendingCharges.mockResolvedValue([{ gid: 'gid://a' }] as never);
    listPurchases.mockResolvedValue([
      { gid: 'gid://other', status: 'ACTIVE' },
      { gid: 'gid://a', status: 'SOMETHING_NEW' },
    ]);

    expect(await ShopifyBillingService.syncPurchases(session)).toEqual({ ok: true, credited: 0 });
    expect(charges.settleCharge).not.toHaveBeenCalled();
  });

  test('records a declined charge without paying anything', async () => {
    charges.listPendingCharges.mockResolvedValue([{ gid: 'gid://a' }] as never);
    listPurchases.mockResolvedValue([{ gid: 'gid://a', status: 'DECLINED' }]);
    charges.settleCharge.mockResolvedValue(0);

    expect(await ShopifyBillingService.syncPurchases(session)).toEqual({ ok: true, credited: 0 });
    expect(charges.settleCharge).toHaveBeenCalledWith('gid://a', 'DECLINED');
  });

  test('reports a Shopify failure', async () => {
    charges.listPendingCharges.mockResolvedValue([{ gid: 'gid://a' }] as never);
    listPurchases.mockRejectedValue(new ShopifyApiError('refused'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await ShopifyBillingService.syncPurchases(session)).toEqual({ ok: false, reason: 'SHOPIFY_ERROR' });
  });

  test('says NOT_FOUND for a shop that is not installed', async () => {
    shops.findShopifyShop.mockResolvedValue(null);

    expect(await ShopifyBillingService.syncPurchases(session)).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });
});

describe('ShopifyBillingService.applyWebhook', () => {
  beforeEach(() => jest.resetAllMocks());

  test("pays out a charge Shopify says is active, for the shop it belongs to", async () => {
    charges.findCharge.mockResolvedValue({ gid: GID, shopDomain: SHOP } as never);

    await ShopifyBillingService.applyWebhook({ shop: SHOP, gid: GID, status: 'ACTIVE' });

    expect(charges.settleCharge).toHaveBeenCalledWith(GID, 'ACTIVE');
  });

  test('ignores a charge that belongs to a different shop than the one the webhook names', async () => {
    charges.findCharge.mockResolvedValue({ gid: GID, shopDomain: 'other.myshopify.com' } as never);

    await ShopifyBillingService.applyWebhook({ shop: SHOP, gid: GID, status: 'ACTIVE' });

    expect(charges.settleCharge).not.toHaveBeenCalled();
  });

  test('ignores an unknown charge and an unknown status', async () => {
    charges.findCharge.mockResolvedValueOnce(null);
    await ShopifyBillingService.applyWebhook({ shop: SHOP, gid: GID, status: 'ACTIVE' });

    charges.findCharge.mockResolvedValueOnce({ gid: GID, shopDomain: SHOP } as never);
    await ShopifyBillingService.applyWebhook({ shop: SHOP, gid: GID, status: 'WEIRD' });

    expect(charges.settleCharge).not.toHaveBeenCalled();
  });
});
