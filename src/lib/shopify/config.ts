/** The Shopify app's credentials, from the environment. Missing values are reported by name, never printed. */

export interface ShopifyConfig {
  clientId: string;
  clientSecret: string;
}

export function readShopifyConfig(env: Record<string, string | undefined> = process.env): ShopifyConfig | null {
  const clientId = env.SHOPIFY_API_KEY?.trim();
  const clientSecret = env.SHOPIFY_API_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
