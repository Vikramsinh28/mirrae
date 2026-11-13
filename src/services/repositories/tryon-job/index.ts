import { prisma } from '@/lib/prisma';

export const createTryOnJob = (data: {
  userId: number;
  personImageKey: string;
  productImageKey: string;
  viewCount: number;
  consentAt: Date;
  expiresAt: Date;
}) => prisma.tryOnJob.create({ data });

export const findTryOnJob = (id: string) => prisma.tryOnJob.findUnique({ where: { id } });

export const findTryOnJobForUser = (id: string, userId: number) =>
  prisma.tryOnJob.findFirst({ where: { id, userId } });

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
