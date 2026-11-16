import { generatePublicKey } from '@/lib/storefront/public-key';
import type { ShopifyConfig } from '@/lib/shopify/config';
import type { Shop } from '@/lib/prisma/generated/client';
import { fetchShopProfile, ShopifyApiError, type ShopProfile } from '@/services/external/shopify/admin';
import * as repo from '@/services/repositories/shopify';
import { CreditService } from './credit';
import { ShopService, uniqueViolationOn, type ShopUsage } from './shop';
import type { UpdateShopInput } from '@/validations/shop';

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

type ResolvedShop = { ok: true; row: Shop } | { ok: false; reason: 'SHOPIFY_ERROR' };

export interface ShopifyOverview {
  shop: InstalledShop;
  credits: number;
  usage: ShopUsage;
}

type SessionInput = { shop: string; sessionToken: string; config: ShopifyConfig };

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
  private static async resolveShop(input: SessionInput): Promise<ResolvedShop> {
    const existing = await repo.findShopifyShop(input.shop);
    if (existing && existing.status !== 'UNINSTALLED') return { ok: true, row: existing };

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
      return { ok: true, row: back };
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
      return { ok: true, row: created };
    } catch (error) {
      // An embedded app fires several requests at once on first load; the loser of the race reads the winner's shop.
      if (!uniqueViolationOn(error, 'domain')) throw error;
      const winner = await repo.findShopifyShop(input.shop);
      if (!winner) throw error;
      return { ok: true, row: winner };
    }
  }

  static async ensureInstalled(input: SessionInput): Promise<EnsureInstalledResult> {
    const resolved = await ShopifyService.resolveShop(input);
    return resolved.ok ? { ok: true, shop: toInstalled(resolved.row) } : resolved;
  }

  /** Everything the embedded admin page shows: the shop, the credits that pay for it, and recent usage with conversion. */
  static async overview(input: SessionInput & { days: number }): Promise<{ ok: true; overview: ShopifyOverview } | { ok: false; reason: 'SHOPIFY_ERROR' }> {
    const resolved = await ShopifyService.resolveShop(input);
    if (!resolved.ok) return resolved;

    const { row } = resolved;
    const [credits, usage] = await Promise.all([CreditService.getUserCredits(row.ownerId), ShopService.usage(row.ownerId, row.id, input.days)]);
    // The shop was just read, so a missing shop here means it was erased a moment ago: treat it as a failed lookup.
    if (!usage.ok) return { ok: false, reason: 'SHOPIFY_ERROR' };

    return { ok: true, overview: { shop: toInstalled(row), credits, usage: usage.usage } };
  }

  /** The merchant switches the try-on button on or off. Only a shop that is already installed can be changed. */
  static async setLive(shop: string, status: NonNullable<UpdateShopInput['status']>): Promise<
    { ok: true; shop: InstalledShop } | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' }
  > {
    const row = await repo.findShopifyShop(shop);
    if (!row) return { ok: false, reason: 'NOT_FOUND' };

    const result = await ShopService.update(row.ownerId, row.id, { status });
    return result.ok ? { ok: true, shop: toInstalled({ ...row, ...result.shop } as Shop) } : result;
  }

  /** The merchant uninstalled the app: the shop stops working at once; its data is kept until Shopify asks for it to be erased. */
  static async markUninstalled(shop: string): Promise<void> {
    await repo.markShopifyShopUninstalled(shop);
  }

  static async erase(shop: string): Promise<void> {
    await repo.eraseShopifyShop(shop);
  }
}
