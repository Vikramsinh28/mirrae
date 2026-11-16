import { findPack, isBillingTest, purchaseStatusFromShopify, returnUrlFor, safeConfirmationUrl } from '@/lib/shopify/billing';
import type { ShopifyConfig } from '@/lib/shopify/config';
import { createOneTimePurchase, listOneTimePurchases, ShopifyApiError } from '@/services/external/shopify/admin';
import * as shopRepo from '@/services/repositories/shopify';
import * as chargeRepo from '@/services/repositories/shopify-charge';

/** Selling credit packs to Shopify merchants through Shopify Billing. Credits are added only for a charge Shopify reports as active. */

type Session = { shop: string; sessionToken: string; config: ShopifyConfig };

export type PurchaseResult =
  | { ok: true; confirmationUrl: string }
  | { ok: false; reason: 'UNKNOWN_PACK' | 'NOT_FOUND' | 'LOCKED' | 'SHOPIFY_ERROR' };

export type SyncResult = { ok: true; credited: number } | { ok: false; reason: 'NOT_FOUND' | 'SHOPIFY_ERROR' };

/** Runs a Shopify call, turning a Shopify failure into a value and letting real bugs through. */
async function shopifyCall<T>(what: string, call: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    if (!(error instanceof ShopifyApiError)) throw error;
    console.error(`Shopify billing ${what} failed:`, error.message);
    return { ok: false };
  }
}

export class ShopifyBillingService {
  /** Starts a purchase: Shopify bills the pack price once the merchant approves, on the page this returns. */
  static async startPurchase(input: Session & { packId: string }): Promise<PurchaseResult> {
    const pack = findPack(input.packId);
    if (!pack) return { ok: false, reason: 'UNKNOWN_PACK' };

    const shop = await shopRepo.findShopifyShop(input.shop);
    if (!shop) return { ok: false, reason: 'NOT_FOUND' };
    if (shop.status === 'UNINSTALLED' || shop.status === 'SUSPENDED') return { ok: false, reason: 'LOCKED' };

    const test = isBillingTest();
    const purchase = await shopifyCall('create purchase', () =>
      createOneTimePurchase({
        ...input,
        name: `${pack.credits} Mirrae try-on credits`,
        priceUsd: pack.priceUsd,
        returnUrl: returnUrlFor(input.shop, input.config.clientId),
        test,
      })
    );
    if (!purchase.ok) return { ok: false, reason: 'SHOPIFY_ERROR' };

    const confirmationUrl = safeConfirmationUrl(purchase.value.confirmationUrl, input.shop);
    if (!confirmationUrl) return { ok: false, reason: 'SHOPIFY_ERROR' };

    await chargeRepo.createCharge({
      shopId: shop.id,
      shopDomain: input.shop,
      gid: purchase.value.gid,
      packId: pack.id,
      credits: pack.credits,
      priceUsd: pack.priceUsd,
      test,
    });
    return { ok: true, confirmationUrl };
  }

  /**
   * Settles this shop's charges that were waiting for approval. Called on every embedded page load: when nothing
   * is waiting it answers from the database without calling Shopify.
   */
  static async syncPurchases(input: Session): Promise<SyncResult> {
    const shop = await shopRepo.findShopifyShop(input.shop);
    if (!shop) return { ok: false, reason: 'NOT_FOUND' };

    const pending = await chargeRepo.listPendingCharges(shop.id);
    if (pending.length === 0) return { ok: true, credited: 0 };

    const listed = await shopifyCall('list purchases', () => listOneTimePurchases(input));
    if (!listed.ok) return { ok: false, reason: 'SHOPIFY_ERROR' };

    const waiting = new Set(pending.map(charge => charge.gid));
    let credited = 0;
    for (const purchase of listed.value) {
      const status = purchaseStatusFromShopify(purchase.status);
      if (!waiting.has(purchase.gid) || status === null || status === 'PENDING') continue;
      credited += await chargeRepo.settleCharge(purchase.gid, status);
    }
    return { ok: true, credited };
  }

  /** A signed Shopify webhook says a purchase changed. It must be one of ours, for the shop that sent it. */
  static async applyWebhook(input: { shop: string; gid: string; status: unknown }): Promise<void> {
    const status = purchaseStatusFromShopify(input.status);
    if (status === null || status === 'PENDING') return;

    const charge = await chargeRepo.findCharge(input.gid);
    if (!charge || charge.shopDomain !== input.shop) return;

    await chargeRepo.settleCharge(input.gid, status);
  }
}
