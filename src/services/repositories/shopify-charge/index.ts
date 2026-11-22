import { CREDIT_TRANSACTION_TYPES } from '@/lib/constants/credits';
import { prisma } from '@/lib/prisma';
import type { PurchaseStatus } from '@/lib/shopify/billing';

/** Data access for credit packs bought through Shopify Billing. */

export interface NewCharge {
  shopId: string;
  shopDomain: string;
  gid: string;
  packId: string;
  credits: number;
  priceUsd: number;
  test: boolean;
}

export const createCharge = (data: NewCharge) => prisma.shopifyCharge.create({ data });

export const findCharge = (gid: string) => prisma.shopifyCharge.findUnique({ where: { gid } });

/** Charges for a shop that are not settled yet (still waiting for the merchant). */
export const listPendingCharges = (shopId: string) =>
  prisma.shopifyCharge.findMany({ where: { shopId, status: 'PENDING' }, select: { gid: true } });

/** Charges for a shop that were opened since a given time and are still waiting for the merchant. */
export const countRecentPendingCharges = (shopId: string, since: Date) =>
  prisma.shopifyCharge.count({ where: { shopId, status: 'PENDING', createdAt: { gte: since } } });

/**
 * Records Shopify's verdict on a charge. For ACTIVE it also pays out the credits, in the SAME transaction that
 * marks the charge as paid (creditedAt), so the credits arrive exactly once however many times, and from
 * however many places (page sync, webhook), the charge is seen as active.
 * Returns the credits added now, or 0 when there was nothing to pay out.
 */
export async function settleCharge(gid: string, status: PurchaseStatus): Promise<number> {
  return prisma.$transaction(async tx => {
    if (status !== 'ACTIVE') {
      // A charge that was already paid out never goes back to a non-paid status.
      await tx.shopifyCharge.updateMany({ where: { gid, creditedAt: null, status: 'PENDING' }, data: { status } });
      return 0;
    }

    const claimed = await tx.shopifyCharge.updateMany({
      where: { gid, creditedAt: null, shopId: { not: null } },
      data: { status: 'ACTIVE', creditedAt: new Date() },
    });
    if (claimed.count === 0) return 0;

    const charge = await tx.shopifyCharge.findUniqueOrThrow({ where: { gid }, include: { shop: { select: { ownerId: true } } } });
    const ownerId = charge.shop?.ownerId;
    if (ownerId === undefined) throw new Error('Charge has no shop to credit');

    const { credits: balanceAfter } = await tx.user.update({
      where: { id: ownerId },
      data: { credits: { increment: charge.credits } },
      select: { credits: true },
    });
    await tx.creditHistory.create({
      data: {
        userId: ownerId,
        type: CREDIT_TRANSACTION_TYPES.CREDIT,
        // Credit purchases are recorded with this operation everywhere (the Stripe top-up does too)
        operation: 'INITIAL_CREDITS',
        amount: charge.credits,
        balanceAfter,
        objectId: gid,
        description: `Credit purchase via Shopify (${charge.packId}${charge.test ? ', test charge' : ''})`,
      },
    });
    return charge.credits;
  });
}
