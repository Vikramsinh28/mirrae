import { prisma } from '@/lib/prisma';
import { CreditService } from './credit';

jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));

interface FakeTx {
  user: { updateMany: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
  creditHistory: { create: jest.Mock };
}

const transaction = prisma.$transaction as unknown as jest.Mock;

function runWith(tx: FakeTx) {
  transaction.mockImplementation(async (callback: (tx: FakeTx) => Promise<unknown>) => callback(tx));
}

const makeTx = (): FakeTx => ({
  user: {
    updateMany: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  creditHistory: { create: jest.fn().mockResolvedValue({}) },
});

describe('CreditService.deductCredits', () => {
  let tx: FakeTx;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    tx = makeTx();
    runWith(tx);
  });

  test('takes the credits with one atomic conditional decrement, never read-then-write', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUniqueOrThrow.mockResolvedValue({ credits: 4 });

    const result = await CreditService.deductCredits({ userId: 7, amount: 1, operation: 'TRYON', objectId: 'job-1' });

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7, credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, newBalance: 4 });
  });

  test('records the balance after the deduction in the history row', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUniqueOrThrow.mockResolvedValue({ credits: 3 });

    await CreditService.deductCredits({ userId: 7, amount: 2, operation: 'TRYON', objectId: 'job-1', description: 'Virtual try-on' });

    expect(tx.creditHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 7, type: 'DEBIT', amount: -2, balanceAfter: 3, objectId: 'job-1' }),
    });
  });

  test('fails with "Insufficient credits" and writes no history when the balance is too low', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    tx.user.findUnique.mockResolvedValue({ id: 7 });

    const result = await CreditService.deductCredits({ userId: 7, amount: 5, operation: 'TRYON' });

    expect(result).toMatchObject({ success: false, error: 'Insufficient credits' });
    expect(tx.creditHistory.create).not.toHaveBeenCalled();
  });

  test('fails with "User not found" when the user does not exist', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    tx.user.findUnique.mockResolvedValue(null);

    const result = await CreditService.deductCredits({ userId: 999, amount: 1, operation: 'TRYON' });

    expect(result).toMatchObject({ success: false, error: 'User not found' });
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses the invalid amount %p before touching the database',
    async amount => {
      const result = await CreditService.deductCredits({ userId: 7, amount, operation: 'TRYON' });

      expect(result).toMatchObject({ success: false, error: 'Invalid amount' });
      expect(transaction).not.toHaveBeenCalled();
    }
  );
});

describe('CreditService.addCredits', () => {
  let tx: FakeTx;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    tx = makeTx();
    runWith(tx);
  });

  test('adds with one atomic increment and records the new balance', async () => {
    tx.user.update.mockResolvedValue({ credits: 15 });

    const result = await CreditService.addCredits({ userId: 7, amount: 10, operation: 'INITIAL_CREDITS' });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { credits: { increment: 10 } },
      select: { credits: true },
    });
    expect(tx.creditHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'CREDIT', amount: 10, balanceAfter: 15 }),
    });
    expect(result).toEqual({ success: true, newBalance: 15 });
  });

  test.each([0, -5, Number.NaN])('refuses the invalid amount %p so a credit can never act as a debit', async amount => {
    const result = await CreditService.addCredits({ userId: 7, amount, operation: 'INITIAL_CREDITS' });

    expect(result).toMatchObject({ success: false, error: 'Invalid amount' });
    expect(transaction).not.toHaveBeenCalled();
  });

  test('reports a missing user instead of throwing', async () => {
    tx.user.update.mockRejectedValue(Object.assign(new Error('Record not found'), { code: 'P2025' }));

    const result = await CreditService.addCredits({ userId: 999, amount: 1, operation: 'INITIAL_CREDITS' });

    expect(result).toMatchObject({ success: false, error: 'User not found' });
  });
});
