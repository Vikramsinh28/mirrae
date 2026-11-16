import { NextRequest, NextResponse } from 'next/server';

import { authenticateShopifyRequest } from '@/lib/shopify/request';
import { ShopifyService } from '@/services/internal/shopify';

export const dynamic = 'force-dynamic';

const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * The embedded app calls this on load with its Shopify session token. It sets the shop up on the first visit
 * and returns what the page needs (the public key is meant to be public; it is the code a store embeds).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateShopifyRequest(request.headers.get('authorization'));
    if (!auth.ok) {
      return auth.reason === 'NOT_CONFIGURED'
        ? reply({ success: false, message: 'The Shopify app is not configured' }, 503)
        : reply({ success: false, message: 'Invalid session' }, 401);
    }

    const result = await ShopifyService.ensureInstalled({ shop: auth.identity.shop, sessionToken: auth.token, config: auth.config });
    if (!result.ok) return reply({ success: false, message: 'Could not reach Shopify. Please reload.' }, 502);

    return reply({ success: true, data: { shop: result.shop } }, 200);
  } catch (error) {
    console.error('Error installing Shopify shop:', error);
    return reply({ success: false, message: 'Something went wrong. Please try again.' }, 500);
  }
}
