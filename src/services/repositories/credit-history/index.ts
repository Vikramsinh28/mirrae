import { prisma } from '@/lib/prisma';

export const addCreditsAndUpdateCreditHistoryTransaction = async ({
  invoiceId,
  customerId,
  proCreditsToAdd,
  packCreditsToAdd,
}: {
  invoiceId: string;
  customerId: string;
  proCreditsToAdd: number;
  packCreditsToAdd: number;
}) => {
  return prisma.$transaction(async tx => {
    // Lock the customer's row first. Try-on charges also take this row lock (their UPDATE), so a top-up can
    // no longer overwrite a concurrent charge with a stale balance, and two deliveries of the same Stripe
    // webhook run one after the other, so the idempotency check below is reliable.
    const [user] = await tx.$queryRaw<{ id: number; credits: number }[]>`
      SELECT id, credits FROM "User" WHERE "stripeCustomerId" = ${customerId} FOR UPDATE`;
    if (!user) return;

    const existing = await tx.creditHistory.findFirst({
      where: { objectId: invoiceId },
      select: { id: true },
    });
    if (existing) return;

    // If this invoice includes a pro subscription renewal, reset credits to 0 for new cycle
    const baseCredits = proCreditsToAdd > 0 ? 0 : user.credits || 0;
    const newBalance = baseCredits + proCreditsToAdd + packCreditsToAdd;

    await tx.user.update({ where: { id: user.id }, data: { credits: newBalance } });
    await tx.creditHistory.create({
      data: {
        userId: user.id,
        type: 'CREDIT',
        operation: 'INITIAL_CREDITS',
        amount: proCreditsToAdd + packCreditsToAdd,
        balanceAfter: newBalance,
        objectId: invoiceId,
        description: `Credit purchase via Stripe invoice`,
      },
    });
  });
};
