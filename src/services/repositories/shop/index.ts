import { prisma } from '@/lib/prisma';
import type { Shop } from '@/lib/prisma/generated/client';

export const findShopByPublicKey = (publicKey: string) => prisma.shop.findUnique({ where: { publicKey } });

export const findShopById = (id: string) => prisma.shop.findUnique({ where: { id } });

/** Try-ons started for a shop since a moment (used for the shop's daily cap). */
export const countShopJobsSince = (shopId: string, since: Date) =>
  prisma.tryOnJob.count({ where: { shopId, createdAt: { gte: since } } });

export interface NewShop {
  ownerId: number;
  name: string;
  platform: 'WEB';
  domain: string;
  publicKey: string;
  allowedOrigins: string[];
  imageHosts: string[];
  /** Set when the website is already proven to be the merchant's (a local development site, or a claim that was verified). */
  verifiedAt?: Date | null;
}

export type ShopChanges = Partial<
  Pick<Shop, 'name' | 'allowedOrigins' | 'imageHosts' | 'dailyTryOnCap' | 'status' | 'publicKey'>
>;

export const listShopsByOwner = (ownerId: number) =>
  prisma.shop.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });

export const countShopsByOwner = (ownerId: number) => prisma.shop.count({ where: { ownerId } });

/** Only the owner can ever see or change a shop: every merchant-facing read goes through this. */
export const findShopByIdForOwner = (id: string, ownerId: number) =>
  prisma.shop.findFirst({ where: { id, ownerId } });

export const createShop = (data: NewShop) => prisma.shop.create({ data });

export const updateShop = (id: string, data: ShopChanges) => prisma.shop.update({ where: { id }, data });

/** Try-ons started per shop since a moment, for the shops list. */
export async function countJobsByShopSince(shopIds: string[], since: Date): Promise<Map<string, number>> {
  const groups = await prisma.tryOnJob.groupBy({
    by: ['shopId'],
    where: { shopId: { in: shopIds }, createdAt: { gte: since } },
    _count: { _all: true },
  });
  return new Map(groups.flatMap(group => (group.shopId ? [[group.shopId, group._count._all] as const] : [])));
}

const RECENT_JOBS = 20;

export async function getShopUsage(shopId: string, since: Date) {
  const inWindow = { shopId, createdAt: { gte: since } };

  const [byStatus, byError, spent, recent] = await Promise.all([
    prisma.tryOnJob.groupBy({ by: ['status'], where: inWindow, _count: { _all: true } }),
    prisma.tryOnJob.groupBy({ by: ['error'], where: { ...inWindow, status: 'FAILED' }, _count: { _all: true } }),
    // The credits actually charged for this shop's try-ons: the history rows reference the job id
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(-ch.amount), 0)::float8 AS total
      FROM "CreditHistory" ch
      JOIN "TryOnJob" j ON j.id::text = ch."objectId"
      WHERE j."shopId" = ${shopId}::uuid AND j."createdAt" >= ${since} AND ch.type = 'DEBIT'`,
    prisma.tryOnJob.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_JOBS,
      select: { id: true, status: true, viewCount: true, createdAt: true, chargedAt: true, error: true },
    }),
  ]);

  return {
    statusCounts: Object.fromEntries(byStatus.map(group => [group.status, group._count._all])) as Record<string, number>,
    failureCodes: byError.map(group => ({ code: group.error ?? '', count: group._count._all })),
    creditsSpent: spent[0]?.total ?? 0,
    recent,
  };
}

export interface SetupFacts {
  /** A finished try-on of their own, made with the dashboard tester. */
  testedTryOn: boolean;
  /** Shoppers have used the widget on one of their shops (any try-on or widget event): the code is on the site. */
  installed: boolean;
  /** A try-on that a shopper started on one of their shops. */
  shopperTryOn: boolean;
}

/** What the getting-started checklist cannot work out from the shops list alone. */
export async function getSetupFacts(ownerId: number): Promise<SetupFacts> {
  const [ownJob, shopperJob, event] = await Promise.all([
    prisma.tryOnJob.findFirst({ where: { userId: ownerId, shopId: null, status: 'DONE' }, select: { id: true } }),
    prisma.tryOnJob.findFirst({ where: { userId: ownerId, shopId: { not: null } }, select: { id: true } }),
    prisma.storefrontEvent.findFirst({ where: { shop: { ownerId } }, select: { id: true } }),
  ]);
  return { testedTryOn: ownJob !== null, installed: shopperJob !== null || event !== null, shopperTryOn: shopperJob !== null };
}

export const findWebShopByDomain = (domain: string) =>
  prisma.shop.findUnique({ where: { platform_domain: { platform: 'WEB', domain } } });

export const markShopVerified = (id: string) => prisma.shop.update({ where: { id }, data: { verifiedAt: new Date() } });

/**
 * A merchant who proved they own a website takes it over from an account that registered it without proving
 * anything. The old, unverified shop is removed and the new, verified one created in one transaction; if the
 * holder was verified in the meantime nothing changes and this returns null.
 */
export function claimDomainFromUnverifiedShop(holderId: string, shop: NewShop) {
  return prisma.$transaction(async tx => {
    const removed = await tx.shop.deleteMany({ where: { id: holderId, platform: 'WEB', verifiedAt: null } });
    if (removed.count === 0) return null;
    return tx.shop.create({ data: { ...shop, verifiedAt: new Date() } });
  });
}
