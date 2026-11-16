import { normalizeMyshopifyDomain } from './shop-domain';

/** The handle of the theme app extension's app embed (the folder name under extensions/ in the Shopify app). */
export const APP_EMBED_HANDLE = 'mirrae-tryon';

/** A deep link that opens the store's theme editor with Mirrae's app embed ready to switch on, or null for a bad address. */
export function themeEditorLink(shopDomain: string, apiKey: string): string | null {
  const shop = normalizeMyshopifyDomain(shopDomain);
  if (!shop) return null;

  const activate = encodeURIComponent(`${apiKey}/${APP_EMBED_HANDLE}`);
  return `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${activate}`;
}
