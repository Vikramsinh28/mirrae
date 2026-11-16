import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Checks the X-Shopify-Hmac-Sha256 header of a webhook: base64 of HMAC-SHA256 over the exact raw request body,
 * keyed with the app's client secret. Compare in constant time and read the body as text BEFORE parsing it.
 */
export function verifyWebhookHmac(rawBody: string, headerValue: string | null | undefined, secret: string): boolean {
  if (!secret || !headerValue) return false;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const received = Buffer.from(headerValue, 'base64');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
