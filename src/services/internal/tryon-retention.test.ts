import * as repo from '@/services/repositories/tryon-job';

import { DEFAULT_RETENTION_DAYS, MIN_RETENTION_DAYS, purgeOldTryOnJobs } from './tryon-retention';

jest.mock('@/services/repositories/tryon-job');

const r = repo as jest.Mocked<typeof repo>;
const NOW = new Date('2026-12-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('purgeOldTryOnJobs', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    r.countFinishedTryOnJobsBefore.mockResolvedValue(7);
    r.deleteFinishedTryOnJobsBefore.mockResolvedValue(7);
  });

  test('a dry run counts the old records and deletes nothing', async () => {
    const result = await purgeOldTryOnJobs({ days: 180, apply: false, now: NOW });

    expect(result).toEqual({ applied: false, cutoff: new Date(NOW.getTime() - 180 * DAY_MS), matched: 7, deleted: 0 });
    expect(r.deleteFinishedTryOnJobsBefore).not.toHaveBeenCalled();
  });

  test('applying deletes records older than the cutoff', async () => {
    const result = await purgeOldTryOnJobs({ days: 100, apply: true, now: NOW });

    const cutoff = new Date(NOW.getTime() - 100 * DAY_MS);
    expect(r.deleteFinishedTryOnJobsBefore).toHaveBeenCalledWith(cutoff);
    expect(result).toEqual({ applied: true, cutoff, matched: 7, deleted: 7 });
  });

  test('uses the default retention when no number of days is given', async () => {
    const result = await purgeOldTryOnJobs({ apply: false, now: NOW });

    expect(result.cutoff).toEqual(new Date(NOW.getTime() - DEFAULT_RETENTION_DAYS * DAY_MS));
  });

  test.each([MIN_RETENTION_DAYS - 1, 0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %p days: the dashboard shows 90 days of usage, so a shorter retention would change its numbers',
    async days => {
      await expect(purgeOldTryOnJobs({ days, apply: true, now: NOW })).rejects.toThrow(/at least/);
      expect(r.deleteFinishedTryOnJobsBefore).not.toHaveBeenCalled();
    }
  );
});
