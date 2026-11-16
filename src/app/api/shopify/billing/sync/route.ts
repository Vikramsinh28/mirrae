import { NextRequest } from 'next/server';

import { refusal, reply, serverError } from '@/app/api/shopify/shopify-route-helpers';
import { authenticateShopifyRequest } from '@/lib/shopify/request';
import { ShopifyBillingService } from '@/services/internal/shopify-billing';

export const dynamic = 'force-dynamic';

/** Adds the credits for any purchase the merchant has approved since the last visit. Safe to call any number of times. */
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateShopifyRequest(request.headers.get('authorization'));
    if (!auth.ok) return refusal(auth);

    const result = await ShopifyBillingService.syncPurchases({ shop: auth.identity.shop, sessionToken: auth.token, config: auth.config });
    if (result.ok) return reply({ success: true, data: { credited: result.credited } });

    return result.reason === 'NOT_FOUND'
      ? reply({ success: false, message: 'Shop not found' }, 404)
      : reply({ success: false, message: 'Could not reach Shopify. Please reload.' }, 502);
  } catch (error) {
    return serverError(error, 'syncing Shopify purchases');
  }
}
