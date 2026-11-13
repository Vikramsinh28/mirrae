import {
  deleteObject,
  generateDownloadUrl,
  objectExists,
  putObject,
} from '@/services/external/aws/s3';
import { runTryOn } from '@/services/external/tryon';
import { generateExtraView } from '@/services/external/tryon-views';
import { CreditService } from '@/services/internal/credit';
import * as repo from '@/services/repositories/tryon-job';
import { TryOnService } from './tryon';
import { prepareTryOnImage } from './tryon-image';

jest.mock('@/services/internal/credit');
jest.mock('@/services/external/aws/s3');
jest.mock('@/services/external/tryon', () => ({
  runTryOn: jest.fn(),
  TryOnProviderError: class extends Error {},
}));
jest.mock('@/services/external/tryon-views', () => ({ generateExtraView: jest.fn() }));
jest.mock('./tryon-image', () => ({
  prepareTryOnImage: jest.fn(),
  TryOnImageError: class extends Error {},
}));
jest.mock('@/services/repositories/tryon-job');
jest.mock('@/services/internal/files/file-upload/file-upload-config', () => ({
  getBucketName: () => 'private-bucket',
}));

const credit = CreditService as jest.Mocked<typeof CreditService>;
const r = repo as jest.Mocked<typeof repo>;
const userId = 7;
const personKey = `tryon/person/u/${userId}/1-a.jpg`;
const productKey = `tryon/product/u/${userId}/1-b.jpg`;
const FIVE_MINUTES_MS = 5 * 60_000;

describe('TryOnService.createJob', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (objectExists as jest.Mock).mockResolvedValue(true);
  });

  const base = { userId, personImageKey: personKey, productImageKey: productKey, consent: true };

  test('rejects when consent is missing', async () => {
    await expect(TryOnService.createJob({ ...base, consent: false })).resolves.toEqual({
      ok: false,
      reason: 'CONSENT_REQUIRED',
    });
    expect(r.createTryOnJob).not.toHaveBeenCalled();
  });

  test('rejects keys that do not belong to the user', async () => {
    const result = await TryOnService.createJob({
      ...base,
      personImageKey: 'tryon/person/u/999/x.jpg',
    });
    expect(result).toEqual({ ok: false, reason: 'INVALID_KEY' });
  });

  test('rejects when either image key does not exist in storage', async () => {
    (objectExists as jest.Mock).mockImplementation(async (_bucket: string, key: string) => {
      return key === personKey;
    });
    const result = await TryOnService.createJob(base);
    expect(result).toEqual({ ok: false, reason: 'INVALID_KEY' });
    expect(r.createTryOnJob).not.toHaveBeenCalled();
  });

  test('rejects when the user has no credit', async () => {
    credit.hassufficientCredits.mockResolvedValue(false);
    const result = await TryOnService.createJob(base);
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_CREDITS' });
    expect(r.createTryOnJob).not.toHaveBeenCalled();
  });

  test('creates a queued single-view job needing 1 credit, with consentAt and a 24h expiry', async () => {
    credit.hassufficientCredits.mockResolvedValue(true);
    r.createTryOnJob.mockResolvedValue({ id: 'job-1' } as never);

    const result = await TryOnService.createJob(base);

    expect(result).toEqual({ ok: true, jobId: 'job-1' });
    expect(credit.hassufficientCredits).toHaveBeenCalledWith(userId, 1);
    expect(objectExists).toHaveBeenCalledWith('private-bucket', personKey);
    expect(objectExists).toHaveBeenCalledWith('private-bucket', productKey);
    const data = r.createTryOnJob.mock.calls[0][0];
    expect(data.viewCount).toBe(1);
    expect(data.consentAt).toBeInstanceOf(Date);
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
  });

  test('a 3-view job needs 2 credits up front and stores viewCount 3', async () => {
    credit.hassufficientCredits.mockResolvedValue(true);
    r.createTryOnJob.mockResolvedValue({ id: 'job-2' } as never);

    await TryOnService.createJob({ ...base, views: 'multi' });

    expect(credit.hassufficientCredits).toHaveBeenCalledWith(userId, 2);
    expect(r.createTryOnJob.mock.calls[0][0].viewCount).toBe(3);
  });

  test('a 3-view job is refused when the user can afford only 1 credit', async () => {
    credit.hassufficientCredits.mockImplementation(async (_user, amount) => amount <= 1);

    const result = await TryOnService.createJob({ ...base, views: 'multi' });

    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_CREDITS' });
    expect(r.createTryOnJob).not.toHaveBeenCalled();
  });
});

describe('TryOnService.processJob', () => {
  const frontImage = { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' };
  const prepared = { base64: 'PREPARED', contentType: 'image/jpeg' };
  const singleJob = { id: 'job-1', userId, personImageKey: personKey, productImageKey: productKey, viewCount: 1 };
  const multiJob = { ...singleJob, viewCount: 3 };

  beforeEach(() => {
    jest.resetAllMocks();
    r.claimQueuedJob.mockResolvedValue(true);
    r.findTryOnJob.mockResolvedValue(singleJob as never);
    (generateDownloadUrl as jest.Mock).mockResolvedValue({ downloadUrl: 'https://signed' });
    (putObject as jest.Mock).mockImplementation(async () => ({ key: 'tryon/result/x.png', bucket: 'b' }));
    (prepareTryOnImage as jest.Mock).mockResolvedValue(prepared);
    (runTryOn as jest.Mock).mockResolvedValue({ image: frontImage });
    (generateExtraView as jest.Mock).mockResolvedValue({ bytes: new Uint8Array([9]), contentType: 'image/png' });
    credit.deductCredits.mockResolvedValue({ success: true, newBalance: 9 });
    r.claimJobCharge.mockResolvedValue(true);
    r.markJobDone.mockResolvedValue(true);
    r.settleExtras.mockResolvedValue(true);
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } }));
  });

  afterEach(() => jest.restoreAllMocks());

  test('does nothing if the job was already claimed', async () => {
    r.claimQueuedJob.mockResolvedValue(false);
    await TryOnService.processJob('job-1');
    expect(runTryOn).not.toHaveBeenCalled();
  });

  test('prepares both downloaded photos and gives the provider the prepared base64', async () => {
    await TryOnService.processJob('job-1');

    expect(prepareTryOnImage).toHaveBeenCalledTimes(2);
    expect(runTryOn).toHaveBeenCalledWith({ personImageBase64: 'PREPARED', productImageBase64: 'PREPARED' });
  });

  test('single view: stores the result, settles immediately, charges 1 credit once and deletes the shopper photo', async () => {
    await TryOnService.processJob('job-1');

    expect(r.markJobDone).toHaveBeenCalledWith('job-1', 'tryon/result/x.png', true);
    expect(generateExtraView).not.toHaveBeenCalled();
    expect(credit.deductCredits).toHaveBeenCalledTimes(1);
    expect(credit.deductCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId, amount: 1, operation: 'TRYON', objectId: 'job-1' })
    );
    expect(deleteObject).toHaveBeenCalledWith('private-bucket', personKey);
  });

  test('does not charge twice when the charge was already claimed', async () => {
    r.claimJobCharge.mockResolvedValue(false);
    await TryOnService.processJob('job-1');
    expect(credit.deductCredits).not.toHaveBeenCalled();
  });

  test('still delivers the result when the charge fails', async () => {
    credit.deductCredits.mockResolvedValue({ success: false, newBalance: 0, error: 'x' });
    await TryOnService.processJob('job-1');
    expect(r.markJobDone).toHaveBeenCalled();
    expect(r.markJobFailed).not.toHaveBeenCalled();
  });

  test('discards the result and never charges if the job was failed while generating', async () => {
    r.markJobDone.mockResolvedValue(false);
    await TryOnService.processJob('job-1');
    expect(credit.deductCredits).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith('private-bucket', 'tryon/result/x.png');
  });

  test('marks the job failed, does not charge and still deletes the photo when the provider fails', async () => {
    (runTryOn as jest.Mock).mockRejectedValue(new Error('boom'));

    await TryOnService.processJob('job-1');

    expect(r.markJobFailed).toHaveBeenCalledWith('job-1', expect.any(String));
    expect(credit.deductCredits).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith('private-bucket', personKey);
  });

  test('fails the job when an input photo cannot be downloaded', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 403 }));

    await TryOnService.processJob('job-1');

    expect(r.markJobFailed).toHaveBeenCalled();
    expect(runTryOn).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith('private-bucket', personKey);
  });

  test('fails the job when the provider result is not an image', async () => {
    (runTryOn as jest.Mock).mockResolvedValue({
      image: { bytes: new Uint8Array([1]), contentType: 'text/html' },
    });
    await TryOnService.processJob('job-1');
    expect(r.markJobFailed).toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });

  describe('3-view jobs', () => {
    beforeEach(() => {
      r.findTryOnJob.mockResolvedValue(multiJob as never);
    });

    test('generates side and back from the front result, then charges 2 credits once', async () => {
      await TryOnService.processJob('job-1');

      expect(r.markJobDone).toHaveBeenCalledWith('job-1', 'tryon/result/x.png', false);
      expect(generateExtraView).toHaveBeenCalledWith(
        expect.objectContaining({ view: 'side', frontImage, garmentBase64: 'PREPARED', garmentContentType: 'image/jpeg' })
      );
      expect(generateExtraView).toHaveBeenCalledWith(expect.objectContaining({ view: 'back', frontImage }));
      expect(r.saveExtraView).toHaveBeenCalledWith('job-1', 'side', 'tryon/result/x.png');
      expect(r.saveExtraView).toHaveBeenCalledWith('job-1', 'back', 'tryon/result/x.png');
      expect(r.settleExtras).toHaveBeenCalledWith('job-1');
      expect(credit.deductCredits).toHaveBeenCalledTimes(1);
      expect(credit.deductCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 2, objectId: 'job-1' }));
    });

    test('deletes the shopper photo before the slow extra views start', async () => {
      await TryOnService.processJob('job-1');

      const deletedAt = (deleteObject as jest.Mock).mock.invocationCallOrder[0];
      const extrasStartedAt = (generateExtraView as jest.Mock).mock.invocationCallOrder[0];
      expect(deletedAt).toBeLessThan(extrasStartedAt);
    });

    test('settles before it charges, so the charge claim can only succeed after the extras finished', async () => {
      await TryOnService.processJob('job-1');

      const settledAt = r.settleExtras.mock.invocationCallOrder[0];
      const claimedAt = r.claimJobCharge.mock.invocationCallOrder[0];
      expect(settledAt).toBeLessThan(claimedAt);
    });

    test('charges only 1 credit when one extra view fails, and keeps the view that worked', async () => {
      (generateExtraView as jest.Mock).mockImplementation(async ({ view }: { view: string }) => {
        if (view === 'back') throw new Error('rate limited');
        return { bytes: new Uint8Array([9]), contentType: 'image/png' };
      });

      await TryOnService.processJob('job-1');

      expect(r.saveExtraView).toHaveBeenCalledTimes(1);
      expect(r.saveExtraView).toHaveBeenCalledWith('job-1', 'side', expect.any(String));
      expect(credit.deductCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }));
      expect(r.markJobFailed).not.toHaveBeenCalled();
    });

    test('still delivers and charges 1 credit when both extra views fail', async () => {
      (generateExtraView as jest.Mock).mockRejectedValue(new Error('down'));

      await TryOnService.processJob('job-1');

      expect(r.saveExtraView).not.toHaveBeenCalled();
      expect(r.settleExtras).toHaveBeenCalledWith('job-1');
      expect(credit.deductCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }));
      expect(r.markJobFailed).not.toHaveBeenCalled();
    });

    test('treats a failed save of an extra view as a failed view and still settles', async () => {
      r.saveExtraView.mockRejectedValue(new Error('db down'));

      await expect(TryOnService.processJob('job-1')).resolves.toBeUndefined();

      expect(r.settleExtras).toHaveBeenCalledWith('job-1');
      expect(credit.deductCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }));
    });

    test('generates no extra views when the front view failed', async () => {
      (runTryOn as jest.Mock).mockRejectedValue(new Error('boom'));

      await TryOnService.processJob('job-1');

      expect(generateExtraView).not.toHaveBeenCalled();
      expect(credit.deductCredits).not.toHaveBeenCalled();
    });

    test('generates no extra views when the job was failed as stale while the front view ran', async () => {
      r.markJobDone.mockResolvedValue(false);

      await TryOnService.processJob('job-1');

      expect(generateExtraView).not.toHaveBeenCalled();
      expect(credit.deductCredits).not.toHaveBeenCalled();
    });
  });
});

describe('TryOnService.getStatus', () => {
  const signed = { downloadUrl: 'https://signed' };

  beforeEach(() => {
    jest.resetAllMocks();
    (generateDownloadUrl as jest.Mock).mockResolvedValue(signed);
  });

  const doneJob = (overrides: object = {}) => ({
    id: 'job-1',
    status: 'DONE',
    resultImageKey: 'tryon/result/front.png',
    sideImageKey: null,
    backImageKey: null,
    viewCount: 1,
    extrasSettledAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  test('returns null for a job the user does not own', async () => {
    r.findTryOnJobForUser.mockResolvedValue(null);
    await expect(TryOnService.getStatus('job-1', userId)).resolves.toBeNull();
  });

  test('returns a signed result url for a finished single-view job', async () => {
    r.findTryOnJobForUser.mockResolvedValue(doneJob() as never);

    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'done',
      resultUrl: 'https://signed',
      viewCount: 1,
      extrasPending: false,
    });
  });

  test('a 3-view job still generating reports the finished views and extrasPending', async () => {
    r.findTryOnJobForUser.mockResolvedValue(
      doneJob({ viewCount: 3, extrasSettledAt: null, sideImageKey: 'tryon/result/side.png' }) as never
    );

    const status = await TryOnService.getStatus('job-1', userId);

    expect(status).toEqual({
      status: 'done',
      resultUrl: 'https://signed',
      sideUrl: 'https://signed',
      viewCount: 3,
      extrasPending: true,
    });
  });

  test('a settled 3-view job returns all three urls and is no longer pending', async () => {
    r.findTryOnJobForUser.mockResolvedValue(
      doneJob({ viewCount: 3, sideImageKey: 's', backImageKey: 'b' }) as never
    );

    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'done',
      resultUrl: 'https://signed',
      sideUrl: 'https://signed',
      backUrl: 'https://signed',
      viewCount: 3,
      extrasPending: false,
    });
  });

  test('stops reporting extras as pending when the job has been silent past the stale window', async () => {
    r.findTryOnJobForUser.mockResolvedValue(
      doneJob({ viewCount: 3, extrasSettledAt: null, updatedAt: new Date(Date.now() - FIVE_MINUTES_MS) }) as never
    );

    const status = await TryOnService.getStatus('job-1', userId);

    expect(status).toMatchObject({ status: 'done', extrasPending: false });
  });

  test('fails a stale processing job', async () => {
    const stale = new Date(Date.now() - 10 * 60_000);
    r.findTryOnJobForUser.mockResolvedValue({ id: 'job-1', status: 'PROCESSING', updatedAt: stale } as never);
    r.failStaleJob.mockResolvedValue(true);

    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'failed',
      error: expect.any(String),
    });
  });

  test('fails a stale queued job that never started processing', async () => {
    const stale = new Date(Date.now() - 10 * 60_000);
    r.findTryOnJobForUser.mockResolvedValue({ id: 'job-1', status: 'QUEUED', updatedAt: stale } as never);
    r.failStaleJob.mockResolvedValue(true);

    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'failed',
      error: expect.any(String),
    });
    expect(r.failStaleJob).toHaveBeenCalled();
  });

  test('reports in-flight jobs as processing', async () => {
    r.findTryOnJobForUser.mockResolvedValue({ id: 'job-1', status: 'QUEUED', updatedAt: new Date() } as never);
    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({ status: 'queued' });
  });
});
