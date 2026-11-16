import { PHOTO_PROBLEM_CODES } from '@/lib/constants/tryon';
import type { Shop } from '@/lib/prisma/generated/client';
import { generatePublicKey } from '@/lib/storefront/public-key';
import { DAY_MS, startOfUtcDay } from '@/lib/time';
import * as repo from '@/services/repositories/shop';
import * as eventRepo from '@/services/repositories/storefront-event';
import type { CreateShopInput, UpdateShopInput } from '@/validations/shop';

/** A merchant's shops: creating them, changing their settings, and reading their usage. Everything is scoped to the owner. */

export const MAX_SHOPS_PER_OWNER = 5;

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const RECENT_WINDOW_DAYS = 7;
const OTHER_FAILURE = 'OTHER';
// A suspended or uninstalled shop is controlled by us; the merchant cannot flip its status either way.
const MERCHANT_CONTROLLED: readonly Shop['status'][] = ['ACTIVE', 'PAUSED'];

/** What the merchant dashboard may see of a shop: everything except who owns it. */
export type ShopView = Omit<Shop, 'ownerId'>;

export interface ShopListItem extends ShopView {
  tryOnsLast7Days: number;
}

/** What shoppers did in the widget, counted in distinct shopper sessions. addToCartRate is null until someone saw a result. */
export interface ShopConversion {
  opened: number;
  sawResult: number;
  addedToCart: number;
  shared: number;
  addToCartRate: number | null;
}

export interface ShopUsage {
  days: number;
  conversion: ShopConversion;
  jobs: { total: number; done: number; failed: number; inProgress: number };
  creditsSpent: number;
  failureReasons: { code: string; count: number }[];
  startedToday: number;
  dailyTryOnCap: number;
  recent: {
    id: string;
    status: string;
    viewCount: number;
    createdAt: Date;
    charged: boolean;
    failureCode: string | null;
  }[];
}

type Failure<Reason extends string> = { ok: false; reason: Reason };

const toView = ({ ownerId: _ownerId, ...shop }: Shop): ShopView => shop;

interface UniqueViolationError {
  code?: string;
  meta?: {
    target?: unknown;
    driverAdapterError?: { cause?: { originalMessage?: string; constraint?: { fields?: unknown } } };
  };
}

/** The fields (and constraint name) a unique violation names. The driver adapter reports them in `cause`, not `meta.target`. */
function violatedFields(error: unknown): string[] {
  const { code, meta } = (error ?? {}) as UniqueViolationError;
  if (code !== PRISMA_UNIQUE_VIOLATION) return [];

  const cause = meta?.driverAdapterError?.cause;
  const reported = [meta?.target, cause?.constraint?.fields].flatMap(value => (Array.isArray(value) ? value : []));
  return [...reported, cause?.originalMessage ?? ''].map(item => String(item).replace(/"/g, ''));
}

export const uniqueViolationOn = (error: unknown, field: string): boolean =>
  violatedFields(error).some(item => item === field || item.includes(`_${field}_`));

const isPhotoProblem = (code: string): boolean => (PHOTO_PROBLEM_CODES as readonly string[]).includes(code);

/** Named photo problems stay named; every other failure is lumped together so internal wording never reaches a report. */
function summariseFailures(codes: { code: string; count: number }[]): { code: string; count: number }[] {
  const named = codes.filter(item => isPhotoProblem(item.code));
  const other = codes.filter(item => !isPhotoProblem(item.code)).reduce((sum, item) => sum + item.count, 0);
  return other > 0 ? [...named, { code: OTHER_FAILURE, count: other }] : named;
}

export class ShopService {
  static async create(
    ownerId: number,
    input: CreateShopInput
  ): Promise<{ ok: true; shop: ShopView } | Failure<'LIMIT_REACHED' | 'DOMAIN_TAKEN'>> {
    if ((await repo.countShopsByOwner(ownerId)) >= MAX_SHOPS_PER_OWNER) return { ok: false, reason: 'LIMIT_REACHED' };

    // The public key is random, so a collision is astronomically unlikely, but a second try costs nothing.
    for (let attempt = 0; ; attempt++) {
      try {
        const shop = await repo.createShop({
          ownerId,
          name: input.name,
          platform: 'WEB',
          domain: input.domain,
          publicKey: generatePublicKey(),
          allowedOrigins: input.allowedOrigins,
          imageHosts: input.imageHosts,
        });
        return { ok: true, shop: toView(shop) };
      } catch (error) {
        if (uniqueViolationOn(error, 'publicKey') && attempt === 0) continue;
        if (uniqueViolationOn(error, 'domain')) return { ok: false, reason: 'DOMAIN_TAKEN' };
        throw error;
      }
    }
  }

  static async list(ownerId: number): Promise<ShopListItem[]> {
    const shops = await repo.listShopsByOwner(ownerId);
    if (shops.length === 0) return [];

    const since = new Date(Date.now() - RECENT_WINDOW_DAYS * DAY_MS);
    const counts = await repo.countJobsByShopSince(
      shops.map(shop => shop.id),
      since
    );
    return shops.map(shop => ({ ...toView(shop), tryOnsLast7Days: counts.get(shop.id) ?? 0 }));
  }

  /** The getting-started facts the checklist cannot work out from the shops list. */
  static async setupStatus(ownerId: number): Promise<repo.SetupFacts> {
    return repo.getSetupFacts(ownerId);
  }

  static async get(ownerId: number, shopId: string): Promise<ShopView | null> {
    const shop = await repo.findShopByIdForOwner(shopId, ownerId);
    return shop ? toView(shop) : null;
  }

  static async update(
    ownerId: number,
    shopId: string,
    input: UpdateShopInput
  ): Promise<{ ok: true; shop: ShopView } | Failure<'NOT_FOUND' | 'LOCKED'>> {
    const shop = await repo.findShopByIdForOwner(shopId, ownerId);
    if (!shop) return { ok: false, reason: 'NOT_FOUND' };

    if (input.status !== undefined && !MERCHANT_CONTROLLED.includes(shop.status)) {
      return { ok: false, reason: 'LOCKED' };
    }

    return { ok: true, shop: toView(await repo.updateShop(shop.id, input)) };
  }

  static async rotateKey(ownerId: number, shopId: string): Promise<{ ok: true; shop: ShopView } | Failure<'NOT_FOUND'>> {
    const shop = await repo.findShopByIdForOwner(shopId, ownerId);
    if (!shop) return { ok: false, reason: 'NOT_FOUND' };

    return { ok: true, shop: toView(await repo.updateShop(shop.id, { publicKey: generatePublicKey() })) };
  }

  static async usage(
    ownerId: number,
    shopId: string,
    days: number
  ): Promise<{ ok: true; usage: ShopUsage } | Failure<'NOT_FOUND'>> {
    const shop = await repo.findShopByIdForOwner(shopId, ownerId);
    if (!shop) return { ok: false, reason: 'NOT_FOUND' };

    const now = new Date();
    const since = new Date(now.getTime() - days * DAY_MS);
    const [report, startedToday, sessions] = await Promise.all([
      repo.getShopUsage(shop.id, since),
      repo.countShopJobsSince(shop.id, startOfUtcDay(now)),
      eventRepo.countSessionsByEventType(shop.id, since),
    ]);

    const count = (status: string) => report.statusCounts[status] ?? 0;
    return {
      ok: true,
      usage: {
        days,
        conversion: {
          opened: sessions.WIDGET_OPENED,
          sawResult: sessions.RESULT_VIEWED,
          addedToCart: sessions.ADD_TO_CART,
          shared: sessions.SHARED,
          // Only sessions that saw a result could add to cart because of it; never above 100%
          addToCartRate:
            sessions.RESULT_VIEWED === 0 ? null : Math.min(1, sessions.ADD_TO_CART / sessions.RESULT_VIEWED),
        },
        jobs: {
          total: Object.values(report.statusCounts).reduce((sum, value) => sum + value, 0),
          done: count('DONE'),
          failed: count('FAILED'),
          inProgress: count('QUEUED') + count('PROCESSING'),
        },
        creditsSpent: report.creditsSpent,
        failureReasons: summariseFailures(report.failureCodes),
        startedToday,
        dailyTryOnCap: shop.dailyTryOnCap,
        recent: report.recent.map(job => ({
          id: job.id,
          status: job.status,
          viewCount: job.viewCount,
          createdAt: job.createdAt,
          charged: job.chargedAt !== null,
          failureCode: job.error !== null && isPhotoProblem(job.error) ? job.error : null,
        })),
      },
    };
  }
}
