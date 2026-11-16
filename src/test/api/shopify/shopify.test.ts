/**
 * Route-handler tests for the Shopify install and webhook endpoints. The service is mocked; these check the
 * HTTP layer: signature and token checks, topics, and that nothing runs before verification.
 */
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';

import { ShopifyService } from '@/services/internal/shopify';

jest.mock('@/services/internal/shopify', () => ({
  ShopifyService: { ensureInstalled: jest.fn(), markUninstalled: jest.fn(), erase: jest.fn() },
}));

const service = ShopifyService as jest.Mocked<typeof ShopifyService>;
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
});
