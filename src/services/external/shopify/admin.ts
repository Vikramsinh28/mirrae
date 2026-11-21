import { z } from 'zod';

import type { ShopifyConfig } from '@/lib/shopify/config';
import type { StorefrontMetafield } from '@/lib/shopify/storefront-config';

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

interface AdminCall {
  shop: string;
  sessionToken: string;
  config: ShopifyConfig;
  fetchImpl?: typeof fetch;
  /** An online token already obtained for this session, so several calls need only one token exchange. */
  accessToken?: string;
}

/** Swaps the embedded app's session token for a short-lived online access token. */
async function onlineAccessToken({ shop, sessionToken, config, fetchImpl = fetch }: AdminCall): Promise<string> {
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
  return exchange.data.access_token;
}

/** One GraphQL call as this session. GraphQL-level errors (HTTP 200 with an "errors" list) are failures too. */
async function graphql(call: AdminCall, query: string, variables: Record<string, unknown>, step: string): Promise<unknown> {
  const { shop, fetchImpl = fetch } = call;
  const accessToken = call.accessToken ?? (await onlineAccessToken(call));

  const reply = (await post(
    fetchImpl,
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    { 'X-Shopify-Access-Token': accessToken },
    { query, variables },
    step
  )) as { data?: unknown; errors?: unknown } | null;

  if (!reply || reply.errors || reply.data === undefined) throw new ShopifyApiError(`Shopify did not accept the request (${step})`);
  return reply.data;
}

export async function fetchShopProfile(input: AdminCall): Promise<ShopProfile> {
  const data = await graphql(input, SHOP_QUERY, {}, 'shop query');

  const parsed = shopReplySchema.shape.data.safeParse(data);
  if (!parsed.success) throw new ShopifyApiError('Shopify did not return the shop details (shop query)');

  const { name, email, primaryDomain } = parsed.data.shop;
  return { name, contactEmail: email ?? null, primaryOrigin: httpsOrigin(primaryDomain?.url) };
}

const CREATE_PURCHASE = `mutation CreatePurchase($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
  appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
    appPurchaseOneTime { id }
    confirmationUrl
    userErrors { field message }
  }
}`;

const LIST_PURCHASES = `{ currentAppInstallation { oneTimePurchases(first: 25, reverse: true) { nodes { id status } } } }`;

const createPurchaseSchema = z.object({
  appPurchaseOneTimeCreate: z.object({
    appPurchaseOneTime: z.object({ id: z.string().min(1) }).nullable(),
    confirmationUrl: z.string().nullable(),
    userErrors: z.array(z.object({ message: z.string() })),
  }),
});

const listPurchasesSchema = z.object({
  currentAppInstallation: z.object({ oneTimePurchases: z.object({ nodes: z.array(z.object({ id: z.string(), status: z.string() })) }) }),
});

export interface CreatedPurchase {
  gid: string;
  confirmationUrl: string;
}

/** Asks Shopify to bill the merchant once. The merchant approves it on the returned confirmation page. */
export async function createOneTimePurchase(
  input: AdminCall & { name: string; priceUsd: number; returnUrl: string; test: boolean }
): Promise<CreatedPurchase> {
  const { name, priceUsd, returnUrl, test, ...call } = input;
  const data = await graphql(call, CREATE_PURCHASE, { name, price: { amount: priceUsd, currencyCode: 'USD' }, returnUrl, test }, 'create purchase');

  const parsed = createPurchaseSchema.safeParse(data);
  if (!parsed.success) throw new ShopifyApiError('Shopify did not return the purchase (create purchase)');

  const { appPurchaseOneTime, confirmationUrl, userErrors } = parsed.data.appPurchaseOneTimeCreate;
  if (userErrors.length > 0 || !appPurchaseOneTime || !confirmationUrl) throw new ShopifyApiError('Shopify refused the purchase (create purchase)');

  return { gid: appPurchaseOneTime.id, confirmationUrl };
}

/** The app's most recent one-time purchases with their current status, for settling ones the merchant has since approved. */
export async function listOneTimePurchases(input: AdminCall): Promise<{ gid: string; status: string }[]> {
  const parsed = listPurchasesSchema.safeParse(await graphql(input, LIST_PURCHASES, {}, 'list purchases'));
  if (!parsed.success) throw new ShopifyApiError('Shopify did not return the purchases (list purchases)');

  return parsed.data.currentAppInstallation.oneTimePurchases.nodes.map(node => ({ gid: node.id, status: node.status }));
}

const INSTALLATION_QUERY = '{ currentAppInstallation { id } }';

const SET_METAFIELDS = `mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key }
    userErrors { message }
  }
}`;

const installationSchema = z.object({ currentAppInstallation: z.object({ id: z.string().min(1) }) });
const metafieldsSetSchema = z.object({ metafieldsSet: z.object({ userErrors: z.array(z.object({ message: z.string() })) }) });

/**
 * Stores values on this app's installation in the shop (app data metafields). The theme app extension reads them
 * in Liquid as `app.metafields.<namespace>.<key>`, which is how the try-on button learns the shop's public key.
 */
export async function setAppMetafields(input: AdminCall & { metafields: readonly StorefrontMetafield[] }): Promise<void> {
  const { metafields, ...call } = input;
  const withToken = { ...call, accessToken: await onlineAccessToken(call) };

  const installation = installationSchema.safeParse(await graphql(withToken, INSTALLATION_QUERY, {}, 'app installation'));
  if (!installation.success) throw new ShopifyApiError('Shopify did not return the app installation (app installation)');

  const ownerId = installation.data.currentAppInstallation.id;
  const result = metafieldsSetSchema.safeParse(
    await graphql(withToken, SET_METAFIELDS, { metafields: metafields.map(field => ({ ...field, ownerId })) }, 'set metafields')
  );
  if (!result.success || result.data.metafieldsSet.userErrors.length > 0) throw new ShopifyApiError('Shopify refused the metafields (set metafields)');
}
