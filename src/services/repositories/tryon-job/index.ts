import { creditsForViewCount, RESERVATION_WINDOW_MS } from '@/lib/constants/tryon';
import { prisma } from '@/lib/prisma';

export interface NewTryOnJob {
  userId: number;
  personImageKey: string;
  productImageKey: string;
  viewCount: number;
  consentAt: Date;
  expiresAt: Date;
  /** Set for storefront try-ons: userId is then the shop owner who pays. */
  shopId?: string;
  sessionId?: string;
}

// First key of the two-int advisory lock, so this lock never collides with other advisory locks.
const TRYON_CREATE_LOCK_NAMESPACE = 41_001;

/**
 * Creates the job only if the user's balance covers it after the credits already held by their running jobs.
 * Creates for one user are serialised with a transaction-scoped advisory lock, so several jobs started at
 * once cannot each pass the check and then finish unpaid.
 */
export const createTryOnJobIfAffordable = (
  data: NewTryOnJob,
  creditsNeeded: number
): Promise<{ ok: true; job: { id: string } } | { ok: false }> =>
  prisma.$transaction(async tx => {
    // $executeRaw, not $queryRaw: the lock function returns void, which Prisma cannot read as a result column.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TRYON_CREATE_LOCK_NAMESPACE}::int, ${data.userId}::int)`;

    const user = await tx.user.findUnique({ where: { id: data.userId }, select: { credits: true } });
    if (!user) return { ok: false as const };

    const holding = await tx.tryOnJob.groupBy({
      by: ['viewCount'],
      where: {
        userId: data.userId,
        updatedAt: { gte: new Date(Date.now() - RESERVATION_WINDOW_MS) },
        OR: [{ status: { in: ['QUEUED', 'PROCESSING'] } }, { status: 'DONE', chargedAt: null }],
      },
      _count: { _all: true },
    });
    const held = holding.reduce((sum, group) => sum + group._count._all * creditsForViewCount(group.viewCount), 0);

    if (user.credits - held < creditsNeeded) return { ok: false as const };

    const job = await tx.tryOnJob.create({ data });
    return { ok: true as const, job: { id: job.id } };
  });

export const findTryOnJob = (id: string) => prisma.tryOnJob.findUnique({ where: { id } });

export const findTryOnJobForUser = (id: string, userId: number) =>
  prisma.tryOnJob.findFirst({ where: { id, userId } });

/** A storefront shopper can only read jobs started by their own session on that shop. */
export const findTryOnJobForSession = (id: string, shopId: string, sessionId: string) =>
  prisma.tryOnJob.findFirst({ where: { id, shopId, sessionId } });

export const claimQueuedJob = async (id: string): Promise<boolean> => {
  const { count } = await prisma.tryOnJob.updateMany({
    where: { id, status: 'QUEUED' },
    data: { status: 'PROCESSING' },
  });
  return count === 1;
};

/**
 * Only transitions PROCESSING -> DONE, so a job already failed as stale can never be revived.
 * `settleExtras` is true for single-view jobs (nothing more to generate); 3-view jobs settle later.
 */
export const markJobDone = async (id: string, resultImageKey: string, settleExtras: boolean): Promise<boolean> => {
  const { count } = await prisma.tryOnJob.updateMany({
    where: { id, status: 'PROCESSING' },
    data: { status: 'DONE', resultImageKey, ...(settleExtras ? { extrasSettledAt: new Date() } : {}) },
  });
  return count === 1;
};

export const saveExtraView = async (id: string, view: 'side' | 'back', imageKey: string): Promise<void> => {
  await prisma.tryOnJob.updateMany({
    where: { id, status: 'DONE' },
    data: view === 'side' ? { sideImageKey: imageKey } : { backImageKey: imageKey },
  });
};

/** Marks that no extra view is still being generated. True only for the first caller. */
export const settleExtras = async (id: string): Promise<boolean> => {
  const { count } = await prisma.tryOnJob.updateMany({
    where: { id, status: 'DONE', extrasSettledAt: null },
    data: { extrasSettledAt: new Date() },
  });
  return count === 1;
};

export const markJobFailed = (id: string, error: string) =>
  prisma.tryOnJob.updateMany({
    where: { id, status: { in: ['QUEUED', 'PROCESSING'] } },
    data: { status: 'FAILED', error },
  });

/**
 * Atomically claims the single charge for a job; true only for the first caller.
 * Requires the extras to be settled, so the amount is only decided once every view has finished or failed.
 */
export const claimJobCharge = async (id: string): Promise<boolean> => {
  const { count } = await prisma.tryOnJob.updateMany({
    where: { id, status: 'DONE', chargedAt: null, extrasSettledAt: { not: null } },
    data: { chargedAt: new Date() },
  });
  return count === 1;
};

export const failStaleJob = async (id: string, staleBefore: Date, error: string) => {
  const { count } = await prisma.tryOnJob.updateMany({
    where: { id, status: { in: ['QUEUED', 'PROCESSING'] }, updatedAt: { lt: staleBefore } },
    data: { status: 'FAILED', error },
  });
  return count === 1;
};

// Retention: only jobs that are over (DONE or FAILED). A job still queued or processing is never touched.
const FINISHED = ['DONE', 'FAILED'] as const;

export const countFinishedTryOnJobsBefore = (cutoff: Date) =>
  prisma.tryOnJob.count({ where: { status: { in: [...FINISHED] }, createdAt: { lt: cutoff } } });

export const deleteFinishedTryOnJobsBefore = async (cutoff: Date): Promise<number> => {
  const { count } = await prisma.tryOnJob.deleteMany({ where: { status: { in: [...FINISHED] }, createdAt: { lt: cutoff } } });
  return count;
};
