import { generatePublicKey } from '@/lib/storefront/public-key';
import type { ShopifyConfig } from '@/lib/shopify/config';
import type { Shop } from '@/lib/prisma/generated/client';
import { storefrontMetafields } from '@/lib/shopify/storefront-config';
import { fetchShopProfile, setAppMetafields, ShopifyApiError, type ShopProfile } from '@/services/external/shopify/admin';
import * as repo from '@/services/repositories/shopify';
import { CreditService } from './credit';
import { ShopService, uniqueViolationOn, type ShopUsage } from './shop';
import type { UpdateShopInput } from '@/validations/shop';

/** Mirrae for Shopify stores: installing, uninstalling and erasing a shop. Callers verify the Shopify token or webhook signature first. */

const SHOPIFY_IMAGE_HOSTS = ['cdn.shopify.com'];

// The extension's values (shop key, widget address) only change when the key or the app address does, so they are
// rewritten at most once an hour per shop, and a failure is retried after 20 seconds instead of on every page load (the first call after an install often fails because the session token has expired or the network blipped, and until it works the store has no button).
const SYNC_INTERVAL_MS = 60 * 60 * 1000;
const SYNC_RETRY_MS = 20 * 1000;
const MAX_TRACKED_SHOPS = 10_000;
const syncState = new Map<string, { at: number; ok: boolean }>();

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

/** Product images: Shopify's CDN plus the primary domain (a store with a custom domain can serve its images from there). Hosts the merchant already trusts are kept. */
const imageHostsFor = (profile: ShopProfile, current: readonly string[] = []): string[] => {
  const primaryHost = profile.primaryOrigin ? new URL(profile.primaryOrigin).hostname : null;
  return [...new Set([...SHOPIFY_IMAGE_HOSTS, ...current, ...(primaryHost ? [primaryHost] : [])])];
};

export type SyncOutcome = 'SYNCED' | 'SKIPPED' | 'FAILED';

export class ShopifyService {
  /**
   * The shop for a verified session token, set up on the first visit. Called on every embedded page load, so a
   * known, installed shop is answered without calling Shopify.
   */
  private static async resolveShop(input: SessionInput): Promise<ResolvedShop> {
    const existing = await repo.findShopifyShop(input.shop);
    if (existing && existing.status !== 'UNINSTALLED' && !existing.uninstalledAt) return { ok: true, row: existing };

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
      const back = await repo.reactivateShopifyShop(existing.id, {
        name: profile.name,
        contactEmail: profile.contactEmail,
        allowedOrigins,
        imageHosts: imageHostsFor(profile, existing.imageHosts),
        // Only a shop that was live comes back live: a suspended or paused one keeps its status
        status: existing.status === 'UNINSTALLED' ? 'ACTIVE' : existing.status,
      });
      syncState.delete(input.shop);
      return { ok: true, row: back };
    }

    try {
      const created = await repo.createShopifyShopWithOwner({
        domain: input.shop,
        name: profile.name,
        contactEmail: profile.contactEmail,
        publicKey: generatePublicKey(),
        allowedOrigins,
        imageHosts: imageHostsFor(profile),
      });
      syncState.delete(input.shop);
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

  /**
   * Gives the theme app extension what it needs to show the try-on button (the shop's public key and where the widget
   * script lives) by storing it on the app installation. Best effort and throttled: it never blocks or fails a page load.
   */
  static async syncStorefrontConfig(
    input: SessionInput & { publicKey: string; appUrl: string | undefined; now?: number }
  ): Promise<SyncOutcome> {
    const now = input.now ?? Date.now();
    const last = syncState.get(input.shop);
    if (last && now - last.at < (last.ok ? SYNC_INTERVAL_MS : SYNC_RETRY_MS)) return 'SKIPPED';

    const metafields = storefrontMetafields(input.publicKey, input.appUrl);
    if (!metafields) {
      console.warn('Shopify storefront config not synced: the app address must be https (set NEXT_PUBLIC_APP_URL)');
      return 'SKIPPED';
    }

    if (syncState.size >= MAX_TRACKED_SHOPS) syncState.clear();
    try {
      await setAppMetafields({ shop: input.shop, sessionToken: input.sessionToken, config: input.config, metafields });
      syncState.set(input.shop, { at: now, ok: true });
      console.info(`Shopify storefront config stored for ${input.shop}`);
      return 'SYNCED';
    } catch (error) {
      if (!(error instanceof ShopifyApiError)) throw error;
      console.error('Shopify storefront config sync failed:', error.message);
      syncState.set(input.shop, { at: now, ok: false });
      return 'FAILED';
    }
  }

  /** The merchant uninstalled the app: the shop stops working at once; its data is kept until Shopify asks for it to be erased. */
  static async markUninstalled(shop: string): Promise<void> {
    await repo.markShopifyShopUninstalled(shop);
    // Shopify deletes an app's metafields on uninstall, so the next install must write them again
    syncState.delete(shop);
  }

  static async erase(shop: string): Promise<void> {
    await repo.eraseShopifyShop(shop);
    syncState.delete(shop);
  }
}
