import { randomUUID } from 'node:crypto';

import { CREDIT_TRANSACTION_TYPES } from '@/lib/constants/credits';
import { prisma } from '@/lib/prisma';
import type { Prisma, Shop } from '@/lib/prisma/generated/client';
import type { AdminShopsQuery } from '@/validations/admin-shops';

/** Platform-wide reads for the admin panel. Nothing here is scoped to one merchant: callers must already be admins. */

export const HIGH_FAILURE_MIN_JOBS = 10;
export const HIGH_FAILURE_RATE = 0.3;
const ATTENTION_LIST_SIZE = 10;
const OUT_OF_CREDITS_BELOW = 1;

const toObject = <K extends string>(rows: { key: K | null; count: number }[]) =>
  Object.fromEntries(rows.flatMap(row => (row.key === null ? [] : [[row.key, row.count] as const]))) as Record<string, number>;

export async function getPlatformStats(since: Date, todayStart: Date) {
  const inWindow = { createdAt: { gte: since } };

  const [shopsByStatus, shopsByPlatform, newShops, merchants, jobsByStatus, jobsToday, failureCodes, creditsSpent, sessions, charges, outOfCredits, highFailure] =
    await Promise.all([
      prisma.shop.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.shop.groupBy({ by: ['platform'], _count: { _all: true } }),
      prisma.shop.count({ where: inWindow }),
      prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(DISTINCT "ownerId")::int AS n FROM "Shop"`,
      prisma.tryOnJob.groupBy({ by: ['status'], where: inWindow, _count: { _all: true } }),
      prisma.tryOnJob.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.tryOnJob.groupBy({ by: ['error'], where: { ...inWindow, status: 'FAILED' }, _count: { _all: true } }),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(-amount), 0)::float8 AS total FROM "CreditHistory" WHERE type = 'DEBIT' AND operation = 'TRYON' AND "createdAt" >= ${since}`,
      prisma.$queryRaw<{ type: string; sessions: number }[]>`
        SELECT "type", COUNT(DISTINCT "sessionId")::int AS sessions FROM "StorefrontEvent" WHERE "createdAt" >= ${since} GROUP BY "type"`,
      prisma.$queryRaw<{ test: boolean; charges: number; revenue: number }[]>`
        SELECT test, COUNT(*)::int AS charges, COALESCE(SUM("priceUsd"), 0)::float8 AS revenue
        FROM "ShopifyCharge" WHERE status = 'ACTIVE' AND "createdAt" >= ${since} GROUP BY test`,
      prisma.shop.findMany({
        where: { status: 'ACTIVE', owner: { credits: { lt: OUT_OF_CREDITS_BELOW } } },
        orderBy: { updatedAt: 'desc' },
        take: ATTENTION_LIST_SIZE,
        select: { id: true, name: true, domain: true, platform: true, owner: { select: { credits: true } } },
      }),
      prisma.$queryRaw<{ id: string; name: string; domain: string; total: number; failed: number }[]>`
        SELECT s.id::text AS id, s.name, s.domain, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE j.status = 'FAILED')::int AS failed
        FROM "TryOnJob" j JOIN "Shop" s ON s.id = j."shopId"
        WHERE j."createdAt" >= ${since}
        GROUP BY s.id, s.name, s.domain
        HAVING COUNT(*) >= ${HIGH_FAILURE_MIN_JOBS} AND COUNT(*) FILTER (WHERE j.status = 'FAILED')::float / COUNT(*) >= ${HIGH_FAILURE_RATE}
        ORDER BY COUNT(*) FILTER (WHERE j.status = 'FAILED')::float / COUNT(*) DESC
        LIMIT ${ATTENTION_LIST_SIZE}`,
    ]);

  return {
    shopsByStatus: toObject(shopsByStatus.map(row => ({ key: row.status, count: row._count._all }))),
    shopsByPlatform: toObject(shopsByPlatform.map(row => ({ key: row.platform, count: row._count._all }))),
    newShops,
    merchants: merchants[0]?.n ?? 0,
    jobsByStatus: toObject(jobsByStatus.map(row => ({ key: row.status, count: row._count._all }))),
    jobsToday,
    failureCodes: failureCodes.map(row => ({ code: row.error ?? '', count: row._count._all })),
    creditsSpent: creditsSpent[0]?.total ?? 0,
    sessionsByEvent: Object.fromEntries(sessions.map(row => [row.type, row.sessions])) as Record<string, number>,
    shopifyCharges: charges,
    outOfCredits: outOfCredits.map(shop => ({ id: shop.id, name: shop.name, domain: shop.domain, platform: shop.platform, credits: shop.owner.credits })),
    highFailure,
  };
}

export async function listShopsForAdmin(query: AdminShopsQuery) {
  const where: Prisma.ShopWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.platform ? { platform: query.platform } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { domain: { contains: query.search, mode: 'insensitive' } },
            { owner: { email: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, shops] = await Promise.all([
    prisma.shop.count({ where }),
    prisma.shop.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      select: {
        id: true,
        name: true,
        domain: true,
        platform: true,
        status: true,
        dailyTryOnCap: true,
        createdAt: true,
        uninstalledAt: true,
        verifiedAt: true,
        owner: { select: { email: true, credits: true } },
      },
    }),
  ]);
  return { total, shops };
}

/** One shop with the account that owns (and pays for) it. */
export const findShopWithOwner = (id: string) =>
  prisma.shop.findUnique({
    where: { id },
    include: { owner: { select: { email: true, credits: true } } },
  });

export const listAuditForShop = (shopId: string, take: number) =>
  prisma.adminAuditLog.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, action: true, details: true, createdAt: true, admin: { select: { email: true } } },
  });

/** Suspends or restores a shop and records who did it, together: either both happen or neither. */
export function setShopStatusWithAudit(input: { adminId: number; shop: Pick<Shop, 'id' | 'name' | 'status'>; status: 'ACTIVE' | 'SUSPENDED' }) {
  const { adminId, shop, status } = input;
  return prisma.$transaction(async tx => {
    const updated = await tx.shop.update({ where: { id: shop.id }, data: { status } });
    await tx.adminAuditLog.create({
      data: {
        adminId,
        shopId: shop.id,
        action: status === 'SUSPENDED' ? 'SHOP_SUSPENDED' : 'SHOP_UNSUSPENDED',
        details: { shopName: shop.name, from: shop.status, to: status },
      },
    });
    return updated;
  });
}

export type CreditAdjustmentResult = { ok: true; balance: number } | { ok: false; reason: 'INSUFFICIENT' };

/**
 * Adds (positive) or removes (negative) credits on a shop's owner account. The balance change, the credit history
 * row and the audit entry are ONE transaction, and a removal can never take the balance below zero (the same
 * conditional UPDATE the try-on charge uses), so concurrent changes cannot lose credits.
 */
export function adjustOwnerCreditsWithAudit(input: {
  adminId: number;
  shop: Pick<Shop, 'id' | 'name' | 'ownerId'>;
  amount: number;
  reason: string;
}): Promise<CreditAdjustmentResult> {
  const { adminId, shop, amount, reason } = input;
  const auditId = randomUUID();

  return prisma.$transaction(async tx => {
    if (amount > 0) {
      await tx.user.update({ where: { id: shop.ownerId }, data: { credits: { increment: amount } } });
    } else {
      const removed = await tx.user.updateMany({ where: { id: shop.ownerId, credits: { gte: -amount } }, data: { credits: { decrement: -amount } } });
      if (removed.count === 0) return { ok: false as const, reason: 'INSUFFICIENT' as const };
    }
    const { credits: balance } = await tx.user.findUniqueOrThrow({ where: { id: shop.ownerId }, select: { credits: true } });

    await tx.creditHistory.create({
      data: {
        userId: shop.ownerId,
        type: amount > 0 ? CREDIT_TRANSACTION_TYPES.CREDIT : CREDIT_TRANSACTION_TYPES.DEBIT,
        operation: 'ADMIN_ADJUSTMENT',
        amount,
        balanceAfter: balance,
        objectId: auditId,
        description: `Admin ${amount > 0 ? 'added' : 'removed'} credits: ${reason}`,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        id: auditId,
        adminId,
        shopId: shop.id,
        action: amount > 0 ? 'CREDITS_GRANTED' : 'CREDITS_REMOVED',
        details: { shopName: shop.name, amount, reason, balanceAfter: balance },
      },
    });
    return { ok: true as const, balance };
  });
}
