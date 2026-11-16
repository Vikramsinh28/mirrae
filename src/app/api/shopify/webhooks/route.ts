import { NextRequest, NextResponse } from 'next/server';

import { readShopifyConfig } from '@/lib/shopify/config';
import { normalizeMyshopifyDomain } from '@/lib/shopify/shop-domain';
import { verifyWebhookHmac } from '@/lib/shopify/webhook-hmac';
import { ShopifyService } from '@/services/internal/shopify';

export const dynamic = 'force-dynamic';

/**
 * Shopify webhooks: the app/uninstalled event and the three privacy ("compliance") topics every App Store app
 * must answer. Mirrae keeps no shopper personal data (the photo is deleted after the front view and events are
 * anonymous), so the customer topics only need a 200. The signature is checked on the exact raw body first.
 */
const CUSTOMER_PRIVACY_TOPICS = ['customers/data_request', 'customers/redact'];

const ok = () => new NextResponse(null, { status: 200 });

export async function POST(request: NextRequest) {
  try {
    const config = readShopifyConfig();
    if (!config) return new NextResponse(null, { status: 503 });

    const rawBody = await request.text();
    if (!verifyWebhookHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), config.clientSecret)) {
      return new NextResponse(null, { status: 401 });
    }

    const topic = request.headers.get('x-shopify-topic') ?? '';
    const shop = normalizeMyshopifyDomain(request.headers.get('x-shopify-shop-domain'));

    if (CUSTOMER_PRIVACY_TOPICS.includes(topic)) return ok();
    if (!shop) return new NextResponse(null, { status: 400 });

    if (topic === 'app/uninstalled') await ShopifyService.markUninstalled(shop);
    else if (topic === 'shop/redact') await ShopifyService.erase(shop);
    // Any other topic is acknowledged so Shopify does not keep retrying something we do not handle.

    return ok();
  } catch (error) {
    console.error('Error handling Shopify webhook:', error);
    // A 500 makes Shopify retry, which is what we want for a real failure.
    return new NextResponse(null, { status: 500 });
  }
}
