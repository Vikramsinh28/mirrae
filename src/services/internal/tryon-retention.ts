import * as repo from '@/services/repositories/tryon-job';

/**
 * How long finished try-on records are kept. A record holds no photo (the shopper photo is deleted right after the
 * front view and result images expire in storage); it is the status, times, consent time and image keys behind the
 * usage numbers, billing history and support. The dashboard shows up to 90 days of usage, so keeping less than that
 * would change its numbers.
 */
export const MIN_RETENTION_DAYS = 90;
export const DEFAULT_RETENTION_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PurgeResult {
  applied: boolean;
  cutoff: Date;
  matched: number;
  deleted: number;
}

/** Counts (dry run, the default) or deletes DONE and FAILED try-on records older than the retention period. */
export async function purgeOldTryOnJobs(options: { days?: number; apply: boolean; now?: Date }): Promise<PurgeResult> {
  const days = options.days ?? DEFAULT_RETENTION_DAYS;
  if (!Number.isInteger(days) || days < MIN_RETENTION_DAYS) {
    throw new Error(`Retention must be a whole number of at least ${MIN_RETENTION_DAYS} days`);
  }

  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const matched = await repo.countFinishedTryOnJobsBefore(cutoff);
  if (!options.apply) return { applied: false, cutoff, matched, deleted: 0 };

  const deleted = await repo.deleteFinishedTryOnJobsBefore(cutoff);
  return { applied: true, cutoff, matched, deleted };
}
