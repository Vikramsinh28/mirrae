import { createHmac, timingSafeEqual } from 'node:crypto';

import { normalizeMyshopifyDomain } from './shop-domain';

/**
 * Verifies the session token the embedded app sends from the Shopify admin (an HS256 JWT signed with the
 * app's client secret). Returns who it is for, or null for anything that is not a valid, current token
 * for THIS app. Never throws: a bad token is a normal event, not an error.
 */

const CLOCK_TOLERANCE_SECONDS = 10;

export interface SessionTokenOptions {
  clientId: string;
  clientSecret: string;
  nowSeconds: number;
}

export interface ShopifySessionIdentity {
  shop: string;
  userId: string | null;
}

function decodePart(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function signatureMatches(unsigned: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(unsigned).digest();
  const received = Buffer.from(signature, 'base64url');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

const hostOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
};

export function verifySessionToken(token: string, { clientId, clientSecret, nowSeconds }: SessionTokenOptions): ShopifySessionIdentity | null {
  if (!clientId || !clientSecret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signature] = parts;

  const header = decodePart(headerPart);
  if (header?.alg !== 'HS256') return null;
  if (!signatureMatches(`${headerPart}.${payloadPart}`, signature, clientSecret)) return null;

  const claims = decodePart(payloadPart);
  if (!claims || claims.aud !== clientId) return null;

  const { exp, nbf } = claims;
  if (typeof exp !== 'number' || exp + CLOCK_TOLERANCE_SECONDS < nowSeconds) return null;
  if (typeof nbf === 'number' && nbf - CLOCK_TOLERANCE_SECONDS > nowSeconds) return null;

  const shop = normalizeMyshopifyDomain(hostOf(claims.dest));
  if (!shop || hostOf(claims.iss) !== shop) return null;

  return { shop, userId: typeof claims.sub === 'string' ? claims.sub : null };
}
