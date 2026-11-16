import { createHmac } from 'node:crypto';

import { verifyWebhookHmac } from './webhook-hmac';

const SECRET = 'shpss_test_secret';
const BODY = JSON.stringify({ shop_domain: 'my-store.myshopify.com' });
const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body, 'utf8').digest('base64');

describe('verifyWebhookHmac', () => {
  test('accepts the signature Shopify computes over the exact raw body', () => {
    expect(verifyWebhookHmac(BODY, sign(BODY), SECRET)).toBe(true);
  });

  test('refuses a body that was changed after signing', () => {
    expect(verifyWebhookHmac(`${BODY} `, sign(BODY), SECRET)).toBe(false);
  });

  test('refuses a signature made with another secret', () => {
    expect(verifyWebhookHmac(BODY, sign(BODY, 'someone-else'), SECRET)).toBe(false);
  });

  test.each([null, undefined, '', 'not-base64!!', 'AAAA'])('refuses a missing or malformed signature header %p', header => {
    expect(verifyWebhookHmac(BODY, header, SECRET)).toBe(false);
  });

  test('refuses everything when no secret is configured', () => {
    expect(verifyWebhookHmac(BODY, sign(BODY, ''), '')).toBe(false);
  });
});
