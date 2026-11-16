import { DAY_MS, startOfUtcDay } from '@/lib/time';
import * as adminRepo from '@/services/repositories/admin';
import * as shopRepo from '@/services/repositories/shop';
import type { AdminCreditAdjustment, AdminShopsQuery } from '@/validations/admin-shops';

import { ShopService, summariseFailures } from './shop';

/** What the operator of Mirrae sees across all merchants. Callers must already have checked that the user is an admin. */

const RECENT_WINDOW_DAYS = 7;
const AUDIT_LIST_SIZE = 20;

export class AdminService {
  static async overview(days: number) {
    const now = new Date();
    const stats = await adminRepo.getPlatformStats(new Date(now.getTime() - days * DAY_MS), startOfUtcDay(now));

    const count = (status: string) => stats.jobsByStatus[status] ?? 0;
    const done = count('DONE');
    const failed = count('FAILED');
    const events = stats.sessionsByEvent;
    const live = stats.shopifyCharges.find(row => !row.test);
    const test = stats.shopifyCharges.find(row => row.test);

    return {
      days,
      merchants: stats.merchants,
      newShops: stats.newShops,
      shopsByStatus: stats.shopsByStatus,
      shopsByPlatform: stats.shopsByPlatform,
      jobs: {
        total: Object.values(stats.jobsByStatus).reduce((sum, value) => sum + value, 0),
        done,
        failed,
        inProgress: count('QUEUED') + count('PROCESSING'),
        successRate: done + failed === 0 ? null : done / (done + failed),
        startedToday: stats.jobsToday,
      },
      creditsSpent: stats.creditsSpent,
      failureReasons: summariseFailures(stats.failureCodes),
      conversion: {
        opened: events.WIDGET_OPENED ?? 0,
        sawResult: events.RESULT_VIEWED ?? 0,
        addedToCart: events.ADD_TO_CART ?? 0,
        shared: events.SHARED ?? 0,
      },
      // Test charges are never billed, so they are counted apart and never as revenue
      shopify: { liveCharges: live?.charges ?? 0, liveRevenueUsd: live?.revenue ?? 0, testCharges: test?.charges ?? 0 },
      attention: {
        outOfCredits: stats.outOfCredits,
        highFailure: stats.highFailure.map(shop => ({ ...shop, failureRate: shop.failed / shop.total })),
      },
    };
  }

  static async listShops(query: AdminShopsQuery) {
    const { total, shops } = await adminRepo.listShopsForAdmin(query);
    if (shops.length === 0) return { total, shops: [] };

    const counts = await shopRepo.countJobsByShopSince(
      shops.map(shop => shop.id),
      new Date(Date.now() - RECENT_WINDOW_DAYS * DAY_MS)
    );
    return { total, shops: shops.map(shop => ({ ...shop, tryOnsLast7Days: counts.get(shop.id) ?? 0 })) };
  }

  /** One shop for the admin: its details, the account that pays for it, recent usage and what admins have done to it. */
  static async shopDetail(shopId: string, days: number) {
    const shop = await adminRepo.findShopWithOwner(shopId);
    if (!shop) return { ok: false as const, reason: 'NOT_FOUND' as const };

    const [usage, audit] = await Promise.all([ShopService.usage(shop.ownerId, shop.id, days), adminRepo.listAuditForShop(shop.id, AUDIT_LIST_SIZE)]);
    if (!usage.ok) return { ok: false as const, reason: 'NOT_FOUND' as const };

    const { ownerId: _ownerId, owner, ...details } = shop;
    return {
      ok: true as const,
      detail: {
        shop: details,
        // A Shopify shop's owner address is made up, so it is not shown
        owner: { email: shop.platform === 'SHOPIFY' ? null : owner.email, credits: owner.credits },
        usage: usage.usage,
        audit: audit.map(entry => ({ id: entry.id, action: entry.action, details: entry.details, createdAt: entry.createdAt, adminEmail: entry.admin.email })),
      },
    };
  }

  /** Suspends a shop (shoppers stop being served at once) or lets it back in, and records who did it. An uninstalled shop is Shopify's to bring back. */
  static async setShopStatus(
    adminId: number,
    shopId: string,
    status: 'ACTIVE' | 'SUSPENDED'
  ): Promise<{ ok: true; status: string } | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' }> {
    const shop = await shopRepo.findShopById(shopId);
    if (!shop) return { ok: false, reason: 'NOT_FOUND' };
    // Uninstalled (even a suspended shop that kept its status) is the merchant's and Shopify's to bring back
    if (shop.status === 'UNINSTALLED' || shop.uninstalledAt) return { ok: false, reason: 'LOCKED' };

    const updated = await adminRepo.setShopStatusWithAudit({ adminId, shop, status });
    return { ok: true, status: updated.status };
  }

  /** Gives credits to, or takes credits from, the account that pays for a shop. Always with a reason, always recorded. */
  static async adjustCredits(
    adminId: number,
    shopId: string,
    adjustment: AdminCreditAdjustment
  ): Promise<{ ok: true; balance: number } | { ok: false; reason: 'NOT_FOUND' | 'INSUFFICIENT' }> {
    const shop = await shopRepo.findShopById(shopId);
    if (!shop) return { ok: false, reason: 'NOT_FOUND' };

    return adminRepo.adjustOwnerCreditsWithAudit({ adminId, shop, amount: adjustment.amount, reason: adjustment.reason });
  }
}
