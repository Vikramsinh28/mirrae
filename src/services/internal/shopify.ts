import { generatePublicKey } from '@/lib/storefront/public-key';
import type { ShopifyConfig } from '@/lib/shopify/config';
import type { Shop } from '@/lib/prisma/generated/client';
import { fetchShopProfile, ShopifyApiError, type ShopProfile } from '@/services/external/shopify/admin';
import * as repo from '@/services/repositories/shopify';
import { uniqueViolationOn } from './shop';

/** Mirrae for Shopify stores: installing, uninstalling and erasing a shop. Callers verify the Shopify token or webhook signature first. */

const SHOPIFY_IMAGE_HOSTS = ['cdn.shopify.com'];

export interface InstalledShop {
  id: string;
  publicKey: string;
  domain: string;
  name: string;
  status: Shop['status'];
}

export type EnsureInstalledResult = { ok: true; shop: InstalledShop } | { ok: false; reason: 'SHOPIFY_ERROR' };

const toInstalled = ({ id, publicKey, domain, name, status }: Shop): InstalledShop => ({ id, publicKey, domain, name, status });

/** Where the widget may run: the store's own address and its primary (custom) domain. */
const allowedOriginsFor = (domain: string, profile: ShopProfile): string[] => [
  `https://${domain}`,
  ...(profile.primaryOrigin && profile.primaryOrigin !== `https://${domain}` ? [profile.primaryOrigin] : []),
];

export class ShopifyService {
  /**
   * The shop for a verified session token, set up on the first visit. Called on every embedded page load, so a
   * known, installed shop is answered without calling Shopify.
   */
  static async ensureInstalled(input: { shop: string; sessionToken: string; config: ShopifyConfig }): Promise<EnsureInstalledResult> {
    const existing = await repo.findShopifyShop(input.shop);
    if (existing && existing.status !== 'UNINSTALLED') return { ok: true, shop: toInstalled(existing) };

    let profile: ShopProfile;
    try {
      profile = await fetchShopProfile(input);
    } catch (error) {
      if (error instanceof ShopifyApiError) {
        console.error('Shopify install lookup failed:', error.message);
        return { ok: false, reason: 'SHOPIFY_ERROR' };
      }
      throw error;
    }

    const allowedOrigins = allowedOriginsFor(input.shop, profile);

    if (existing) {
      const back = await repo.reactivateShopifyShop(existing.id, { name: profile.name, contactEmail: profile.contactEmail, allowedOrigins });
      return { ok: true, shop: toInstalled(back) };
    }

    try {
      const created = await repo.createShopifyShopWithOwner({
        domain: input.shop,
        name: profile.name,
        contactEmail: profile.contactEmail,
        publicKey: generatePublicKey(),
        allowedOrigins,
        imageHosts: SHOPIFY_IMAGE_HOSTS,
      });
      return { ok: true, shop: toInstalled(created) };
    } catch (error) {
      // An embedded app fires several requests at once on first load; the loser of the race reads the winner's shop.
      if (!uniqueViolationOn(error, 'domain')) throw error;
      const winner = await repo.findShopifyShop(input.shop);
      if (!winner) throw error;
      return { ok: true, shop: toInstalled(winner) };
    }
  }

  /** The merchant uninstalled the app: the shop stops working at once; its data is kept until Shopify asks for it to be erased. */
  static async markUninstalled(shop: string): Promise<void> {
    await repo.markShopifyShopUninstalled(shop);
  }

  static async erase(shop: string): Promise<void> {
    await repo.eraseShopifyShop(shop);
  }
}
