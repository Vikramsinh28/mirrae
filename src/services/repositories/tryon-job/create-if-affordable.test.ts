import { prisma } from '@/lib/prisma';
import { createTryOnJobIfAffordable } from './index';

jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));

const transaction = prisma.$transaction as unknown as jest.Mock;

interface FakeTx {
  $executeRaw: jest.Mock;
  user: { findUnique: jest.Mock };
  tryOnJob: { groupBy: jest.Mock; create: jest.Mock };
}

const data = {
  userId: 7,
  personImageKey: 'tryon/person/u/7/a.jpg',
  productImageKey: 'tryon/product/u/7/b.jpg',
  viewCount: 1,
  consentAt: new Date(),
  expiresAt: new Date(),
};

function setup({ credits, active = [] }: { credits: number | null; active?: { viewCount: number; count: number }[] }) {
  const tx: FakeTx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    user: { findUnique: jest.fn().mockResolvedValue(credits === null ? null : { credits }) },
    tryOnJob: {
      groupBy: jest.fn().mockResolvedValue(active.map(({ viewCount, count }) => ({ viewCount, _count: { _all: count } }))),
      create: jest.fn().mockResolvedValue({ id: 'job-1' }),
    },
  };
  transaction.mockImplementation(async (callback: (tx: FakeTx) => Promise<unknown>) => callback(tx));
  return tx;
}

describe('createTryOnJobIfAffordable', () => {
  beforeEach(() => jest.resetAllMocks());

  test('creates the job when the balance covers it and nothing else is holding credits', async () => {
    const tx = setup({ credits: 5 });

    await expect(createTryOnJobIfAffordable(data, 1)).resolves.toEqual({ ok: true, job: { id: 'job-1' } });
    expect(tx.tryOnJob.create).toHaveBeenCalledWith({ data });
  });

  test('takes a per-user lock before it reads the balance, so concurrent creates are serialised', async () => {
    const tx = setup({ credits: 5 });

    await createTryOnJobIfAffordable(data, 1);

    const lockedAt = tx.$executeRaw.mock.invocationCallOrder[0];
    const readAt = tx.user.findUnique.mock.invocationCallOrder[0];
    expect(lockedAt).toBeLessThan(readAt);
    expect(String(tx.$executeRaw.mock.calls[0][0].join(''))).toContain('pg_advisory_xact_lock');
    expect(tx.$executeRaw.mock.calls[0]).toContain(7);
    // The lock function returns void; $queryRaw cannot read that column, so it must never be used for it
    expect(tx).not.toHaveProperty('$queryRaw');
  });

  test('refuses when running jobs already hold the credits (2 credits, one 3-view job running)', async () => {
    const tx = setup({ credits: 2, active: [{ viewCount: 3, count: 1 }] });

    await expect(createTryOnJobIfAffordable(data, 1)).resolves.toEqual({ ok: false });
    expect(tx.tryOnJob.create).not.toHaveBeenCalled();
  });

  test('prices held credits per job: one single-view and one 3-view job hold 3 credits', async () => {
    setup({ credits: 3, active: [{ viewCount: 1, count: 1 }, { viewCount: 3, count: 1 }] });
    await expect(createTryOnJobIfAffordable(data, 1)).resolves.toEqual({ ok: false });

    setup({ credits: 4, active: [{ viewCount: 1, count: 1 }, { viewCount: 3, count: 1 }] });
    await expect(createTryOnJobIfAffordable(data, 1)).resolves.toMatchObject({ ok: true });
  });

  test('only counts jobs that are in flight or finished-but-uncharged and not silent past the reservation window', async () => {
    const tx = setup({ credits: 5 });

    await createTryOnJobIfAffordable(data, 1);

    const { where } = tx.tryOnJob.groupBy.mock.calls[0][0];
    expect(where.userId).toBe(7);
    expect(where.updatedAt.gte).toBeInstanceOf(Date);
    expect(where.OR).toEqual([
      { status: { in: ['QUEUED', 'PROCESSING'] } },
      { status: 'DONE', chargedAt: null },
    ]);
  });

  test('refuses a user that does not exist', async () => {
    const tx = setup({ credits: null });

    await expect(createTryOnJobIfAffordable(data, 1)).resolves.toEqual({ ok: false });
    expect(tx.tryOnJob.create).not.toHaveBeenCalled();
  });

  test('allows exactly the balance: 2 credits available covers a 2-credit job', async () => {
    setup({ credits: 2 });
    await expect(createTryOnJobIfAffordable({ ...data, viewCount: 3 }, 2)).resolves.toMatchObject({ ok: true });
  });
});
