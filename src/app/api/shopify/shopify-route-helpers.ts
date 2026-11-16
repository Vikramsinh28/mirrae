import { NextResponse } from 'next/server';

import type { ShopifyRequestAuth } from '@/lib/shopify/request';

/** Small helpers shared by the routes the embedded Shopify page calls. */

export const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function refusal(auth: Extract<ShopifyRequestAuth, { ok: false }>) {
  return auth.reason === 'NOT_CONFIGURED'
    ? reply({ success: false, message: 'The Shopify app is not configured' }, 503)
    : reply({ success: false, message: 'Invalid session' }, 401);
}

export function serverError(error: unknown, what: string) {
  console.error(`Error ${what}:`, error);
  return reply({ success: false, message: 'Something went wrong. Please try again.' }, 500);
}
