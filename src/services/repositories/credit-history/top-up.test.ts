import { prisma } from '@/lib/prisma';
import { addCreditsAndUpdateCreditHistoryTransaction } from './index';

jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));

const transaction = prisma.$transaction as unknown as jest.Mock;

interface FakeTx {
  $queryRaw: jest.Mock;
  creditHistory: { findFirst: jest.Mock; create: jest.Mock };
  user: { update: jest.Mock };
}

function setup({ lockedUser, alreadyCredited = false }: { lockedUser: { id: number; credits: number } | null; alreadyCredited?: boolean }) {
  const tx: FakeTx = {
    $queryRaw: jest.fn().mockResolvedValue(lockedUser ? [lockedUser] : []),
    creditHistory: {
      findFirst: jest.fn().mockResolvedValue(alreadyCredited ? { id: 1 } : null),
      create: jest.fn().mockResolvedValue({}),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
  };
  transaction.mockImplementation(async (callback: (tx: FakeTx) => Promise<unknown>) => callback(tx));
  return tx;
}

const args = { invoiceId: 'in_1', customerId: 'cus_1', proCreditsToAdd: 0, packCreditsToAdd: 50 };

describe('addCreditsAndUpdateCreditHistoryTransaction', () => {
  beforeEach(() => jest.resetAllMocks());

  test('locks the customer row first, so a concurrent try-on charge or a duplicate webhook cannot interleave', async () => {
    const tx = setup({ lockedUser: { id: 7, credits: 10 } });

    await addCreditsAndUpdateCreditHistoryTransaction(args);

    expect(String(tx.$queryRaw.mock.calls[0][0].join(' '))).toMatch(/FOR UPDATE/);
    expect(tx.$queryRaw.mock.calls[0]).toContain('cus_1');
    const lockedAt = tx.$queryRaw.mock.invocationCallOrder[0];
    const checkedAt = tx.creditHistory.findFirst.mock.invocationCallOrder[0];
    expect(lockedAt).toBeLessThan(checkedAt);
  });

  test('adds the pack credits on top of the locked balance and records one history row', async () => {
    const tx = setup({ lockedUser: { id: 7, credits: 10 } });

    await addCreditsAndUpdateCreditHistoryTransaction(args);

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { credits: 60 } });
    expect(tx.creditHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 7, amount: 50, balanceAfter: 60, objectId: 'in_1' }),
    });
  });

  test('a pro renewal starts the new cycle from zero', async () => {
    const tx = setup({ lockedUser: { id: 7, credits: 10 } });

    await addCreditsAndUpdateCreditHistoryTransaction({ ...args, proCreditsToAdd: 100, packCreditsToAdd: 0 });

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { credits: 100 } });
  });

  test('credits an invoice only once, even when Stripe delivers the webhook twice', async () => {
    const tx = setup({ lockedUser: { id: 7, credits: 10 }, alreadyCredited: true });

    await addCreditsAndUpdateCreditHistoryTransaction(args);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.creditHistory.create).not.toHaveBeenCalled();
  });

  test('does nothing for an unknown Stripe customer', async () => {
    const tx = setup({ lockedUser: null });

    await addCreditsAndUpdateCreditHistoryTransaction(args);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.creditHistory.create).not.toHaveBeenCalled();
  });
});
