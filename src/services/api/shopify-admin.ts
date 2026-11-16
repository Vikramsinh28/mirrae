import type { ShopUsage } from './shops';

/** Calls Mirrae's embedded-admin API with a Shopify session token (not the Mirrae login cookie). */

export interface EmbeddedShop {
  id: string;
  name: string;
  domain: string;
  publicKey: string;
  status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'UNINSTALLED';
}

export interface ShopifyOverview {
  shop: EmbeddedShop;
  credits: number;
  usage: ShopUsage;
}

export type GetSessionToken = () => Promise<string>;

async function call<T>(getToken: GetSessionToken, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}`, ...init.headers },
  });

  const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: T; message?: string } | null;
  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.message ?? 'Something went wrong. Please try again.');
  }
  return payload.data;
}

export const shopifyAdminApi = {
  overview: (getToken: GetSessionToken, days: number) => call<ShopifyOverview>(getToken, `/api/shopify/shop?days=${days}`),

  /** Starts buying a credit pack; the merchant approves the charge on the returned Shopify page. */
  purchase: (getToken: GetSessionToken, packId: string) =>
    call<{ confirmationUrl: string }>(getToken, '/api/shopify/billing/purchase', { method: 'POST', body: JSON.stringify({ packId }) }),

  /** Adds the credits for purchases approved since the last visit; returns how many were added now. */
  syncPurchases: (getToken: GetSessionToken) => call<{ credited: number }>(getToken, '/api/shopify/billing/sync', { method: 'POST' }),

  setLive: (getToken: GetSessionToken, status: 'ACTIVE' | 'PAUSED') =>
    call<{ shop: EmbeddedShop }>(getToken, '/api/shopify/shop', { method: 'PATCH', body: JSON.stringify({ status }) }),
};
