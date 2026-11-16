import { prisma } from '@/lib/prisma';
import type { StorefrontEventType } from '@/lib/prisma/generated/client';

export const createStorefrontEvent = (data: { shopId: string; sessionId: string; type: StorefrontEventType }) =>
  prisma.storefrontEvent.create({ data, select: { id: true } });

/** Shopper sessions that produced each kind of event for a shop since a moment (one session counts once per type). */
export async function countSessionsByEventType(shopId: string, since: Date): Promise<Record<StorefrontEventType, number>> {
  const rows = await prisma.$queryRaw<{ type: StorefrontEventType; sessions: number }[]>`
    SELECT "type", COUNT(DISTINCT "sessionId")::int AS sessions
    FROM "StorefrontEvent"
    WHERE "shopId" = ${shopId}::uuid AND "createdAt" >= ${since}
    GROUP BY "type"`;

  const counts: Record<StorefrontEventType, number> = { WIDGET_OPENED: 0, RESULT_VIEWED: 0, ADD_TO_CART: 0, SHARED: 0 };
  for (const row of rows) counts[row.type] = row.sessions;
  return counts;
}
