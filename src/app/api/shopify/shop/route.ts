import { NextRequest, after } from 'next/server';

import { siteConfig } from '@/app/siteConfig';

import { refusal, reply, serverError } from '@/app/api/shopify/shopify-route-helpers';

import { authenticateShopifyRequest } from '@/lib/shopify/request';
import { ShopifyService } from '@/services/internal/shopify';
import { shopSwitchSchema, usageQuerySchema } from '@/validations/shop';

export const dynamic = 'force-dynamic';

/** The embedded admin page's data. Every call carries the Shopify session token, which says which shop it is. */

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateShopifyRequest(request.headers.get('authorization'));
    if (!auth.ok) return refusal(auth);

    const query = usageQuerySchema.safeParse({ days: request.nextUrl.searchParams.get('days') ?? undefined });
    if (!query.success) return reply({ success: false, message: 'Invalid input data' }, 400);

    const result = await ShopifyService.overview({
      shop: auth.identity.shop,
      sessionToken: auth.token,
      config: auth.config,
      days: query.data.days,
    });
    if (!result.ok) return reply({ success: false, message: 'Could not reach Shopify. Please reload.' }, 502);

    // After the response: the extension's values must never slow down or break the page
    after(() =>
      ShopifyService.syncStorefrontConfig({
        shop: auth.identity.shop,
        sessionToken: auth.token,
        config: auth.config,
        publicKey: result.overview.shop.publicKey,
        appUrl: siteConfig.url,
      })
    );

    return reply({ success: true, data: result.overview });
  } catch (error) {
    return serverError(error, 'loading the Shopify admin page');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = authenticateShopifyRequest(request.headers.get('authorization'));
    if (!auth.ok) return refusal(auth);

    const body = shopSwitchSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return reply({ success: false, message: 'Invalid input data' }, 400);

    const result = await ShopifyService.setLive(auth.identity.shop, body.data.status);
    if (result.ok) return reply({ success: true, data: { shop: result.shop } });

    return result.reason === 'NOT_FOUND'
      ? reply({ success: false, message: 'Shop not found' }, 404)
      : reply({ success: false, message: 'This shop cannot be switched right now. Please contact support.' }, 403);
  } catch (error) {
    return serverError(error, 'switching the Shopify shop');
  }
}
