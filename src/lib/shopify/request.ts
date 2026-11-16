import { readShopifyConfig, type ShopifyConfig } from './config';
import { verifySessionToken, type ShopifySessionIdentity } from './session-token';

/** Reads and checks the Shopify session token an embedded page sends as "Authorization: Bearer <token>". */

export type ShopifyRequestAuth =
  | { ok: true; identity: ShopifySessionIdentity; token: string; config: ShopifyConfig }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'UNAUTHORIZED' };

export function authenticateShopifyRequest(authorization: string | null, nowSeconds = Math.floor(Date.now() / 1000)): ShopifyRequestAuth {
  const config = readShopifyConfig();
  if (!config) return { ok: false, reason: 'NOT_CONFIGURED' };

  const match = /^Bearer (\S+)$/.exec(authorization ?? '');
  if (!match) return { ok: false, reason: 'UNAUTHORIZED' };

  const identity = verifySessionToken(match[1], { ...config, nowSeconds });
  return identity ? { ok: true, identity, token: match[1], config } : { ok: false, reason: 'UNAUTHORIZED' };
}
