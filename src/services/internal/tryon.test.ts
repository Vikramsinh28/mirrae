import { CreditService } from '@/services/internal/credit';
import {
  deleteObject,
  generateDownloadUrl,
  objectExists,
  putObject,
} from '@/services/external/aws/s3';
import { runTryOn } from '@/services/external/tryon';
import * as repo from '@/services/repositories/tryon-job';
import { TryOnService } from './tryon';

jest.mock('@/services/internal/credit');
jest.mock('@/services/external/aws/s3');
jest.mock('@/services/external/tryon', () => ({
  runTryOn: jest.fn(),
  TryOnProviderError: class extends Error {},
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

  test('creates a queued job with consentAt and a 24h expiry', async () => {
    credit.hassufficientCredits.mockResolvedValue(true);
    r.createTryOnJob.mockResolvedValue({ id: 'job-1' } as never);

    const result = await TryOnService.createJob(base);

    expect(result).toEqual({ ok: true, jobId: 'job-1' });
    expect(objectExists).toHaveBeenCalledWith('private-bucket', personKey);
    expect(objectExists).toHaveBeenCalledWith('private-bucket', productKey);
    const data = r.createTryOnJob.mock.calls[0][0];
    expect(data.consentAt).toBeInstanceOf(Date);
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
  });
});

describe('TryOnService.processJob', () => {
  const job = {
    id: 'job-1',
    userId,
    personImageKey: personKey,
    productImageKey: productKey,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    r.claimQueuedJob.mockResolvedValue(true);
    r.findTryOnJob.mockResolvedValue(job as never);
    (generateDownloadUrl as jest.Mock).mockResolvedValue({ downloadUrl: 'https://signed' });
    (putObject as jest.Mock).mockResolvedValue({ key: 'tryon/result/x.png', bucket: 'b' });
    (runTryOn as jest.Mock).mockResolvedValue({ resultUrl: 'https://fal.media/out.png' });
    credit.deductCredits.mockResolvedValue({ success: true, newBalance: 9 });
    r.claimJobCharge.mockResolvedValue(true);
    r.markJobDone.mockResolvedValue(true);
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
    );
  });

  afterEach(() => jest.restoreAllMocks());

  test('discards the result and never charges if the job was failed while generating', async () => {
    r.markJobDone.mockResolvedValue(false);
    await TryOnService.processJob('job-1');
    expect(credit.deductCredits).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith('private-bucket', 'tryon/result/x.png');
  });

  test('does nothing if the job was already claimed', async () => {
    r.claimQueuedJob.mockResolvedValue(false);
    await TryOnService.processJob('job-1');
    expect(runTryOn).not.toHaveBeenCalled();
  });

  test('on success stores the result, charges 1 credit once and deletes the shopper photo', async () => {
    await TryOnService.processJob('job-1');

    expect(r.markJobDone).toHaveBeenCalledWith('job-1', 'tryon/result/x.png');
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

  test('marks the job failed, does not charge and still deletes the photo when the provider fails', async () => {
    (runTryOn as jest.Mock).mockRejectedValue(new Error('boom'));

    await TryOnService.processJob('job-1');

    expect(r.markJobFailed).toHaveBeenCalledWith('job-1', expect.any(String));
    expect(credit.deductCredits).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith('private-bucket', personKey);
  });

  test('fails the job when the result is not an https image', async () => {
    (runTryOn as jest.Mock).mockResolvedValue({ resultUrl: 'http://insecure/out.png' });
    await TryOnService.processJob('job-1');
    expect(r.markJobFailed).toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });
});

describe('TryOnService.getStatus', () => {
  beforeEach(() => jest.resetAllMocks());

  test('returns null for a job the user does not own', async () => {
    r.findTryOnJobForUser.mockResolvedValue(null);
    await expect(TryOnService.getStatus('job-1', userId)).resolves.toBeNull();
  });

  test('returns a signed result url for a done job', async () => {
    r.findTryOnJobForUser.mockResolvedValue({
      id: 'job-1',
      status: 'DONE',
      resultImageKey: 'tryon/result/x.png',
      updatedAt: new Date(),
    } as never);
    (generateDownloadUrl as jest.Mock).mockResolvedValue({ downloadUrl: 'https://signed' });

    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'done',
      resultUrl: 'https://signed',
    });
  });

  test('fails a stale processing job', async () => {
    const stale = new Date(Date.now() - 10 * 60_000);
    r.findTryOnJobForUser.mockResolvedValue({
      id: 'job-1',
      status: 'PROCESSING',
      updatedAt: stale,
    } as never);
    r.failStaleJob.mockResolvedValue(true);

    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'failed',
      error: expect.any(String),
    });
  });

  test('fails a stale queued job that never started processing', async () => {
    const stale = new Date(Date.now() - 10 * 60_000);
    r.findTryOnJobForUser.mockResolvedValue({
      id: 'job-1',
      status: 'QUEUED',
      updatedAt: stale,
    } as never);
    r.failStaleJob.mockResolvedValue(true);

    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'failed',
      error: expect.any(String),
    });
    expect(r.failStaleJob).toHaveBeenCalled();
  });

  test('reports in-flight jobs as processing', async () => {
    r.findTryOnJobForUser.mockResolvedValue({
      id: 'job-1',
      status: 'QUEUED',
      updatedAt: new Date(),
    } as never);
    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'queued',
    });
  });
});
