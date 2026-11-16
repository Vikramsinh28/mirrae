import { z } from 'zod';

import type { ShopifyConfig } from '@/lib/shopify/config';

/**
 * Talks to a shop's Shopify Admin API. The embedded app's session token is swapped for a short-lived ONLINE
 * access token on each use (token exchange), so no Shopify access token is ever stored. Stored offline tokens
 * (which Shopify now wants to expire and rotate) are only worth adding when a background job needs them.
 */

// Shopify releases a stable API version every quarter; this is the one this code was written against.
export const SHOPIFY_API_VERSION = '2026-10';
const REQUEST_TIMEOUT_MS = 10_000;

const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const ID_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id_token';
const ONLINE_TOKEN_TYPE = 'urn:shopify:params:oauth:token-type:online-access-token';

const SHOP_QUERY = '{ shop { name email primaryDomain { url } } }';

/** A Shopify call failed. The message says which step, and never contains a secret or a token. */
export class ShopifyApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShopifyApiError';
  }
}

export interface ShopProfile {
  name: string;
  contactEmail: string | null;
  /** The store's primary website origin when it is https (a custom domain, usually), else null. */
  primaryOrigin: string | null;
}

const exchangeReplySchema = z.object({ access_token: z.string().min(1) });
const shopReplySchema = z.object({
  data: z.object({
    shop: z.object({
      name: z.string(),
      email: z.string().nullable().optional(),
      primaryDomain: z.object({ url: z.string() }).nullable().optional(),
    }),
  }),
});

function httpsOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

async function post(fetchImpl: typeof fetch, url: string, headers: Record<string, string>, body: unknown, step: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ShopifyApiError(`Could not reach Shopify (${step})`);
  }
  if (!response.ok) throw new ShopifyApiError(`Shopify refused the request (${step}, HTTP ${response.status})`);

  try {
    return await response.json();
  } catch {
    throw new ShopifyApiError(`Shopify sent an unreadable answer (${step})`);
  }
}

export async function fetchShopProfile(input: {
  shop: string;
  sessionToken: string;
  config: ShopifyConfig;
  fetchImpl?: typeof fetch;
}): Promise<ShopProfile> {
  const { shop, sessionToken, config, fetchImpl = fetch } = input;

  const exchange = exchangeReplySchema.safeParse(
    await post(
      fetchImpl,
      `https://${shop}/admin/oauth/access_token`,
      {},
      {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: TOKEN_EXCHANGE_GRANT,
        subject_token: sessionToken,
        subject_token_type: ID_TOKEN_TYPE,
        requested_token_type: ONLINE_TOKEN_TYPE,
      },
      'token exchange'
    )
  );
  if (!exchange.success) throw new ShopifyApiError('Shopify did not return an access token (token exchange)');

  const reply = shopReplySchema.safeParse(
    await post(
      fetchImpl,
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      { 'X-Shopify-Access-Token': exchange.data.access_token },
      { query: SHOP_QUERY },
      'shop query'
    )
  );
  if (!reply.success) throw new ShopifyApiError('Shopify did not return the shop details (shop query)');

  const { name, email, primaryDomain } = reply.data.data.shop;
  return { name, contactEmail: email ?? null, primaryOrigin: httpsOrigin(primaryDomain?.url) };
}
