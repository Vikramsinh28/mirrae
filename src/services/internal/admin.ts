import { PHOTO_PROBLEM_CODES } from '@/lib/constants/tryon';
import { DAY_MS, startOfUtcDay } from '@/lib/time';
import * as adminRepo from '@/services/repositories/admin';
import * as shopRepo from '@/services/repositories/shop';
import type { AdminShopsQuery } from '@/validations/admin-shops';

/** What the operator of Mirrae sees across all merchants. Callers must already have checked that the user is an admin. */

const RECENT_WINDOW_DAYS = 7;
const OTHER_FAILURE = 'OTHER';

const isPhotoProblem = (code: string): boolean => (PHOTO_PROBLEM_CODES as readonly string[]).includes(code);

/** Named photo problems stay named; everything else is lumped, so internal error wording never reaches a report. */
function summariseFailures(codes: { code: string; count: number }[]): { code: string; count: number }[] {
  const named = codes.filter(item => isPhotoProblem(item.code));
  const other = codes.filter(item => !isPhotoProblem(item.code)).reduce((sum, item) => sum + item.count, 0);
  return other > 0 ? [...named, { code: OTHER_FAILURE, count: other }] : named;
}

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

  /** Suspends a shop (shoppers stop being served at once) or lets it back in. An uninstalled shop is Shopify's to bring back. */
  static async setShopStatus(
    shopId: string,
    status: 'ACTIVE' | 'SUSPENDED'
  ): Promise<{ ok: true; status: string } | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' }> {
    const shop = await shopRepo.findShopById(shopId);
    if (!shop) return { ok: false, reason: 'NOT_FOUND' };
    if (shop.status === 'UNINSTALLED') return { ok: false, reason: 'LOCKED' };

    const updated = await shopRepo.updateShop(shop.id, { status });
    return { ok: true, status: updated.status };
  }
}
