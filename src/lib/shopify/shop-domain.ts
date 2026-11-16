/**
 * Shopify store addresses (<name>.myshopify.com). The value arrives in query strings and tokens, and we later
 * call Shopify at that address with the shop's access token, so anything that is not exactly a store address
 * (another host, a user-info trick, a sub-domain) is refused here.
 */

const MYSHOPIFY_HOST = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** The lower-case store address, or null when the input is not exactly one (a leading https:// and a trailing slash are tolerated). */
export function normalizeMyshopifyDomain(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '');
  return MYSHOPIFY_HOST.test(trimmed) ? trimmed : null;
}

export const isMyshopifyDomain = (input: string | null | undefined): boolean => normalizeMyshopifyDomain(input) !== null;
