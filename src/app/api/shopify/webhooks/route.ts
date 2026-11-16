import { NextRequest, NextResponse } from 'next/server';

import { readBodyCapped } from '@/lib/storefront/http';
import { readShopifyConfig } from '@/lib/shopify/config';
import { normalizeMyshopifyDomain } from '@/lib/shopify/shop-domain';
import { verifyWebhookHmac } from '@/lib/shopify/webhook-hmac';
import { ShopifyService } from '@/services/internal/shopify';
import { ShopifyBillingService } from '@/services/internal/shopify-billing';

export const dynamic = 'force-dynamic';

/**
 * Shopify webhooks: the app/uninstalled event and the three privacy ("compliance") topics every App Store app
 * must answer. Mirrae keeps no shopper personal data (the photo is deleted after the front view and events are
 * anonymous), so the customer topics only need a 200. The signature is checked on the exact raw body first.
 */
const CUSTOMER_PRIVACY_TOPICS = ['customers/data_request', 'customers/redact'];

// Real Shopify webhook bodies are small JSON; anything near this size is not one
const MAX_WEBHOOK_BYTES = 256 * 1024;

const ok = () => new NextResponse(null, { status: 200 });

export async function POST(request: NextRequest) {
  try {
    const config = readShopifyConfig();
    if (!config) return new NextResponse(null, { status: 503 });

    // This route is public: cap the body BEFORE reading it, because the signature can only be checked afterwards
    const bytes = await readBodyCapped(request, MAX_WEBHOOK_BYTES);
    if (!bytes) return new NextResponse(null, { status: 413 });
    const rawBody = new TextDecoder().decode(bytes);
    if (!verifyWebhookHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), config.clientSecret)) {
      return new NextResponse(null, { status: 401 });
    }

    const topic = request.headers.get('x-shopify-topic') ?? '';
    const shop = normalizeMyshopifyDomain(request.headers.get('x-shopify-shop-domain'));

    if (CUSTOMER_PRIVACY_TOPICS.includes(topic)) return ok();
    if (!shop) return new NextResponse(null, { status: 400 });

    if (topic === 'app/uninstalled') await ShopifyService.markUninstalled(shop);
    else if (topic === 'shop/redact') await ShopifyService.erase(shop);
    else if (topic === 'app_purchases_one_time/update') await handlePurchaseUpdate(shop, rawBody);
    // Any other topic is acknowledged so Shopify does not keep retrying something we do not handle.

    return ok();
  } catch (error) {
    console.error('Error handling Shopify webhook:', error);
    // A 500 makes Shopify retry, which is what we want for a real failure.
    return new NextResponse(null, { status: 500 });
  }
}

/** The body is only trusted after the signature check above; a body that is not the expected shape is ignored. */
async function handlePurchaseUpdate(shop: string, rawBody: string): Promise<void> {
  let purchase: { admin_graphql_api_id?: unknown; status?: unknown } | undefined;
  try {
    purchase = (JSON.parse(rawBody) as { app_purchase_one_time?: typeof purchase }).app_purchase_one_time;
  } catch {
    return;
  }
  if (typeof purchase?.admin_graphql_api_id !== 'string') return;

  await ShopifyBillingService.applyWebhook({ shop, gid: purchase.admin_graphql_api_id, status: purchase.status });
}
