import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

/**
 * Short-lived signed token that lets an anonymous shopper talk to the storefront API on behalf of one shop.
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256). It is not a login: it only proves the
 * session was opened for this shop (from an allowed origin) recently, and it carries nothing secret.
 *
 * Needs STOREFRONT_TOKEN_SECRET (at least 32 characters).
 */

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

export interface StorefrontSession {
  shopId: string;
  sessionId: string;
}

const payloadSchema = z.object({
  shopId: z.string().min(1),
  sessionId: z.string().min(1),
  exp: z.number(),
});

/** The server secret, also used (with a different label) to derive website verification tokens. */
export function getSecret(): string {
  const secret = process.env.STOREFRONT_TOKEN_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`STOREFRONT_TOKEN_SECRET is required (at least ${MIN_SECRET_LENGTH} characters)`);
  }
  return secret;
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function signStorefrontToken(session: StorefrontSession, now: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: now + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload, getSecret())}`;
}

/** The session the token was issued for, or null for anything forged, malformed, expired or unconfigured. */
export function verifyStorefrontToken(token: string, now: number = Date.now()): StorefrontSession | null {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    if (!parsed.success || parsed.data.exp < now) return null;
    return { shopId: parsed.data.shopId, sessionId: parsed.data.sessionId };
  } catch {
    return null;
  }
}
