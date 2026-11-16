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

/** Whether the merchant has ever finished a try-on of their own (not a shopper's) with the dashboard tester. */
export async function hasFinishedOwnTryOn(ownerId: number): Promise<boolean> {
  const job = await prisma.tryOnJob.findFirst({
    where: { userId: ownerId, shopId: null, status: 'DONE' },
    select: { id: true },
  });
  return job !== null;
}
