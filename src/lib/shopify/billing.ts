/**
 * Selling credits through Shopify Billing. Prices live here, on the server side of the contract: the client only
 * ever names a pack id, never an amount.
 */

export interface CreditPack {
  id: string;
  credits: number;
  priceUsd: number;
}

// PLACEHOLDER PRICES: the owner has not set real ones yet. Work out cost per credit (Vertex + Gemini) and
// Shopify's revenue share before switching billing to live. Ordered smallest to largest.
export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: 'pack_50', credits: 50, priceUsd: 9 },
  { id: 'pack_200', credits: 200, priceUsd: 29 },
  { id: 'pack_1000', credits: 1000, priceUsd: 129 },
];

const PACKS_BY_ID = new Map(CREDIT_PACKS.map(pack => [pack.id, pack]));

export const findPack = (id: string): CreditPack | null => PACKS_BY_ID.get(id) ?? null;

/**
 * Whether new charges are Shopify TEST charges (nobody is billed, yet credits are still paid out). SHOPIFY_BILLING_LIVE
 * decides when it is set ("true" bills for real, "false" tests). When it is unset, production bills for real and every
 * other environment tests, so forgetting the setting in production can never hand out free credits.
 */
export const isBillingTest = (env: Record<string, string | undefined> = process.env): boolean => {
  if (env.SHOPIFY_BILLING_LIVE === 'true') return false;
  if (env.SHOPIFY_BILLING_LIVE === 'false') return true;
  return env.NODE_ENV !== 'production';
};

export type PurchaseStatus = 'PENDING' | 'ACTIVE' | 'DECLINED' | 'EXPIRED';

const KNOWN_STATUSES: readonly string[] = ['PENDING', 'ACTIVE', 'DECLINED', 'EXPIRED'];

/** Shopify's purchase status as ours, or null for anything unknown: only an explicit ACTIVE may pay out credits. */
export function purchaseStatusFromShopify(value: unknown): PurchaseStatus | null {
  if (typeof value !== 'string') return null;
  const status = value.trim().toUpperCase();
  return KNOWN_STATUSES.includes(status) ? (status as PurchaseStatus) : null;
}

/** Where Shopify sends the merchant after they approve or decline: back into the app in their admin. */
export const returnUrlFor = (shopDomain: string, clientId: string): string => `https://${shopDomain}/admin/apps/${clientId}`;

/** The approval page Shopify returned, only if it really is a Shopify admin address for this shop (the merchant is redirected to it). */
export function safeConfirmationUrl(value: string | null | undefined, shopDomain: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostOk = url.hostname === shopDomain || url.hostname === 'admin.shopify.com';
    return url.protocol === 'https:' && hostOk ? url.href : null;
  } catch {
    return null;
  }
}
