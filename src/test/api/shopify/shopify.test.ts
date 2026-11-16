/**
 * Route-handler tests for the Shopify install and webhook endpoints. The service is mocked; these check the
 * HTTP layer: signature and token checks, topics, and that nothing runs before verification.
 */
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';

import { ShopifyService } from '@/services/internal/shopify';
import { ShopifyBillingService } from '@/services/internal/shopify-billing';

jest.mock('@/services/internal/shopify-billing', () => ({
  ShopifyBillingService: { startPurchase: jest.fn(), syncPurchases: jest.fn(), applyWebhook: jest.fn() },
}));
jest.mock('@/services/internal/shopify', () => ({
  ShopifyService: { ensureInstalled: jest.fn(), overview: jest.fn(), setLive: jest.fn(), markUninstalled: jest.fn(), erase: jest.fn() },
}));

const service = ShopifyService as jest.Mocked<typeof ShopifyService>;
const billing = ShopifyBillingService as jest.Mocked<typeof ShopifyBillingService>;
const SECRET = 'the-secret';
const SHOP = 'my-store.myshopify.com';
const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body, 'utf8').digest('base64');

function webhook(topic: string, { body = '{}', secret = SECRET, shop = SHOP }: { body?: string; secret?: string; shop?: string } = {}) {
  return new NextRequest('http://localhost/api/shopify/webhooks', {
    method: 'POST',
    headers: { 'x-shopify-hmac-sha256': sign(body, secret), 'x-shopify-topic': topic, 'x-shopify-shop-domain': shop },
    body,
  });
}

describe('Shopify routes', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SHOPIFY_API_KEY = 'the-id';
    process.env.SHOPIFY_API_SECRET = SECRET;
  });
  afterAll(() => {
    process.env = { ...saved };
  });

  describe('POST /api/shopify/webhooks', () => {
    const post = async (request: NextRequest) => (await import('@/app/api/shopify/webhooks/route')).POST(request);

    test('refuses a request with a bad signature before doing anything', async () => {
      const response = await post(webhook('app/uninstalled', { secret: 'attacker' }));

      expect(response.status).toBe(401);
      expect(service.markUninstalled).not.toHaveBeenCalled();
    });

    test('marks the shop uninstalled', async () => {
      const response = await post(webhook('app/uninstalled'));

      expect(response.status).toBe(200);
      expect(service.markUninstalled).toHaveBeenCalledWith(SHOP);
    });

    test('erases the shop on shop/redact', async () => {
      expect((await post(webhook('shop/redact'))).status).toBe(200);
      expect(service.erase).toHaveBeenCalledWith(SHOP);
    });

    test.each(['customers/data_request', 'customers/redact'])('%s is acknowledged: no shopper personal data is kept', async topic => {
      const response = await post(webhook(topic, { shop: 'not-a-shop' }));

      expect(response.status).toBe(200);
      expect(service.markUninstalled).not.toHaveBeenCalled();
      expect(service.erase).not.toHaveBeenCalled();
    });

    test('refuses a shop that is not a myshopify.com address', async () => {
      const response = await post(webhook('app/uninstalled', { shop: 'evil.com' }));

      expect(response.status).toBe(400);
      expect(service.markUninstalled).not.toHaveBeenCalled();
    });

    test('acknowledges a topic it does not handle', async () => {
      expect((await post(webhook('orders/create'))).status).toBe(200);
    });

    test('asks Shopify to retry when handling fails', async () => {
      service.markUninstalled.mockRejectedValue(new Error('db down'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      expect((await post(webhook('app/uninstalled'))).status).toBe(500);
    });

    test('says unavailable when the app credentials are missing', async () => {
      delete process.env.SHOPIFY_API_SECRET;

      expect((await post(webhook('app/uninstalled'))).status).toBe(503);
    });
  });

  describe('POST /api/shopify/install', () => {
    const post = async (authorization?: string) =>
      (await import('@/app/api/shopify/install/route')).POST(
        new NextRequest('http://localhost/api/shopify/install', { method: 'POST', headers: authorization ? { authorization } : {} })
      );

    test('needs a session token', async () => {
      expect((await post()).status).toBe(401);
      expect(service.ensureInstalled).not.toHaveBeenCalled();
    });

    test('refuses a token that is not signed by Shopify for this app', async () => {
      expect((await post('Bearer a.b.c')).status).toBe(401);
      expect(service.ensureInstalled).not.toHaveBeenCalled();
    });
  });

  describe('GET and PATCH /api/shopify/shop', () => {
    const NOW = Math.floor(Date.now() / 1000);
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const bearer = (secret = SECRET) => {
      const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
        iss: `https://${SHOP}/admin`,
        dest: `https://${SHOP}`,
        aud: 'the-id',
        sub: '1',
        exp: NOW + 60,
        nbf: NOW - 5,
      })}`;
      return `Bearer ${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
    };
    const route = () => import('@/app/api/shopify/shop/route');
    const get = async (query = '', authorization: string | null = bearer()) =>
      (await route()).GET(new NextRequest(`http://localhost/api/shopify/shop${query}`, { headers: authorization ? { authorization } : {} }));
    const patch = async (body: unknown, authorization: string | null = bearer()) =>
      (await route()).PATCH(
        new NextRequest('http://localhost/api/shopify/shop', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
          body: JSON.stringify(body),
        })
      );

    test('needs a valid session token', async () => {
      expect((await get('', null)).status).toBe(401);
      expect((await get('', bearer('attacker'))).status).toBe(401);
      expect(service.overview).not.toHaveBeenCalled();
    });

    test('answers for the shop in the token, never one named in the request', async () => {
      service.overview.mockResolvedValue({ ok: true, overview: { shop: { id: 's' }, credits: 5, usage: {} } as never });

      const response = await get('?days=7&shop=other.myshopify.com');

      expect(response.status).toBe(200);
      expect(service.overview).toHaveBeenCalledWith(expect.objectContaining({ shop: SHOP, days: 7 }));
    });

    test('rejects a bad days value', async () => {
      expect((await get('?days=abc')).status).toBe(400);
    });

    test('reports a Shopify failure as a gateway error', async () => {
      service.overview.mockResolvedValue({ ok: false, reason: 'SHOPIFY_ERROR' });

      expect((await get()).status).toBe(502);
    });

    test('switches the shop on or off', async () => {
      service.setLive.mockResolvedValue({ ok: true, shop: { id: 's', status: 'PAUSED' } as never });

      const response = await patch({ status: 'PAUSED' });

      expect(response.status).toBe(200);
      expect(service.setLive).toHaveBeenCalledWith(SHOP, 'PAUSED');
    });

    test.each([{ status: 'SUSPENDED' }, { status: 'UNINSTALLED' }, {}, null])('refuses to let the merchant set %p', async body => {
      expect((await patch(body)).status).toBe(400);
      expect(service.setLive).not.toHaveBeenCalled();
    });

    test('maps a locked shop to 403 and an unknown one to 404', async () => {
      service.setLive.mockResolvedValueOnce({ ok: false, reason: 'LOCKED' }).mockResolvedValueOnce({ ok: false, reason: 'NOT_FOUND' });

      expect((await patch({ status: 'ACTIVE' })).status).toBe(403);
      expect((await patch({ status: 'ACTIVE' })).status).toBe(404);
    });

    test('needs a valid session token to switch', async () => {
      expect((await patch({ status: 'PAUSED' }, null)).status).toBe(401);
      expect(service.setLive).not.toHaveBeenCalled();
    });
  });

  describe('app_purchases_one_time/update webhook', () => {
    const post = async (request: NextRequest) => (await import('@/app/api/shopify/webhooks/route')).POST(request);
    const body = (status: string) => JSON.stringify({ app_purchase_one_time: { admin_graphql_api_id: 'gid://shopify/AppPurchaseOneTime/1', status } });

    test('passes the signed purchase update to billing', async () => {
      const response = await post(webhook('app_purchases_one_time/update', { body: body('ACTIVE') }));

      expect(response.status).toBe(200);
      expect(billing.applyWebhook).toHaveBeenCalledWith({ shop: SHOP, gid: 'gid://shopify/AppPurchaseOneTime/1', status: 'ACTIVE' });
    });

    test('never reaches billing when the signature is wrong', async () => {
      const response = await post(webhook('app_purchases_one_time/update', { body: body('ACTIVE'), secret: 'attacker' }));

      expect(response.status).toBe(401);
      expect(billing.applyWebhook).not.toHaveBeenCalled();
    });

    test.each(['not json', '{}', JSON.stringify({ app_purchase_one_time: {} })])('ignores a body that is not a purchase update: %p', async raw => {
      expect((await post(webhook('app_purchases_one_time/update', { body: raw }))).status).toBe(200);
      expect(billing.applyWebhook).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/shopify/billing/*', () => {
    const NOW = Math.floor(Date.now() / 1000);
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const bearer = () => {
      const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: `https://${SHOP}/admin`, dest: `https://${SHOP}`, aud: 'the-id', sub: '1', exp: NOW + 60, nbf: NOW - 5 })}`;
      return `Bearer ${unsigned}.${createHmac('sha256', SECRET).update(unsigned).digest('base64url')}`;
    };
    const purchase = async (body: unknown, authorization: string | null = bearer()) =>
      (await import('@/app/api/shopify/billing/purchase/route')).POST(
        new NextRequest('http://localhost/api/shopify/billing/purchase', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
          body: JSON.stringify(body),
        })
      );
    const sync = async (authorization: string | null = bearer()) =>
      (await import('@/app/api/shopify/billing/sync/route')).POST(
        new NextRequest('http://localhost/api/shopify/billing/sync', { method: 'POST', headers: authorization ? { authorization } : {} })
      );

    test('both need a valid session token', async () => {
      expect((await purchase({ packId: 'pack_50' }, null)).status).toBe(401);
      expect((await sync(null)).status).toBe(401);
      expect(billing.startPurchase).not.toHaveBeenCalled();
      expect(billing.syncPurchases).not.toHaveBeenCalled();
    });

    test('purchase returns the approval page for the shop in the token', async () => {
      billing.startPurchase.mockResolvedValue({ ok: true, confirmationUrl: 'https://my-store.myshopify.com/admin/charges/1/confirm' });

      const response = await purchase({ packId: 'pack_50', shop: 'other.myshopify.com' });

      expect(response.status).toBe(200);
      expect((await response.json()).data.confirmationUrl).toContain('/charges/1/confirm');
      expect(billing.startPurchase).toHaveBeenCalledWith(expect.objectContaining({ shop: SHOP, packId: 'pack_50' }));
    });

    test.each([{}, { packId: '' }, null])('purchase rejects a bad body %p', async body => {
      expect((await purchase(body)).status).toBe(400);
    });

    test.each([
      ['UNKNOWN_PACK', 400],
      ['NOT_FOUND', 404],
      ['LOCKED', 403],
      ['SHOPIFY_ERROR', 502],
    ] as const)('purchase maps %s to HTTP %i', async (reason, status) => {
      billing.startPurchase.mockResolvedValue({ ok: false, reason });

      expect((await purchase({ packId: 'pack_50' })).status).toBe(status);
    });

    test('sync reports how many credits were just added', async () => {
      billing.syncPurchases.mockResolvedValue({ ok: true, credited: 50 });

      const response = await sync();

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ credited: 50 });
    });

    test.each([
      ['NOT_FOUND', 404],
      ['SHOPIFY_ERROR', 502],
    ] as const)('sync maps %s to HTTP %i', async (reason, status) => {
      billing.syncPurchases.mockResolvedValue({ ok: false, reason });

      expect((await sync()).status).toBe(status);
    });
  });
});
