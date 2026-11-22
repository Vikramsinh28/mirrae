import { NextRequest } from 'next/server';
import { z } from 'zod';

import { refusal, reply, serverError } from '@/app/api/shopify/shopify-route-helpers';
import { authenticateShopifyRequest } from '@/lib/shopify/request';
import { ShopifyBillingService } from '@/services/internal/shopify-billing';

export const dynamic = 'force-dynamic';

const purchaseSchema = z.object({ packId: z.string().min(1).max(64) });

/** Starts buying a credit pack. Returns the Shopify page where the merchant approves the charge. */
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateShopifyRequest(request.headers.get('authorization'));
    if (!auth.ok) return refusal(auth);

    const body = purchaseSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return reply({ success: false, message: 'Invalid input data' }, 400);

    const result = await ShopifyBillingService.startPurchase({
      shop: auth.identity.shop,
      sessionToken: auth.token,
      config: auth.config,
      packId: body.data.packId,
    });
    if (result.ok) return reply({ success: true, data: { confirmationUrl: result.confirmationUrl } });

    const failures = {
      UNKNOWN_PACK: reply({ success: false, message: 'That credit pack does not exist' }, 400),
      NOT_FOUND: reply({ success: false, message: 'Shop not found' }, 404),
      LOCKED: reply({ success: false, message: 'Credits cannot be bought for this shop right now. Please contact support.' }, 403),
      TOO_MANY_PENDING: reply(
        { success: false, message: 'Several purchases are already waiting for your approval. Approve one in Shopify, or try again tomorrow.' },
        429
      ),
      SHOPIFY_ERROR: reply({ success: false, message: 'Shopify could not start the purchase. Please try again.' }, 502),
    } as const;
    return failures[result.reason];
  } catch (error) {
    return serverError(error, 'starting a Shopify credit purchase');
  }
}
