import {
  deleteObject,
  generateDownloadUrl,
  objectExists,
  putObject,
} from '@/services/external/aws/s3';
import { runTryOn } from '@/services/external/tryon';
import { findPhotoProblem } from '@/services/external/tryon-check';
import { generateExtraView } from '@/services/external/tryon-views';
import { CreditService } from '@/services/internal/credit';
import * as repo from '@/services/repositories/tryon-job';
import { PHOTO_PROBLEM_MESSAGES, TryOnService } from './tryon';
import { PHOTO_PROBLEM_CODES } from '@/lib/constants/tryon';
import { prepareTryOnImage } from './tryon-image';

jest.mock('@/services/internal/credit');
jest.mock('@/services/external/aws/s3');
jest.mock('@/services/external/tryon', () => ({
  runTryOn: jest.fn(),
  TryOnProviderError: class extends Error {},
}));
jest.mock('@/services/external/tryon-views', () => ({ generateExtraView: jest.fn() }));
jest.mock('@/services/external/tryon-check', () => ({ findPhotoProblem: jest.fn() }));
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
    expect(r.createTryOnJobIfAffordable).not.toHaveBeenCalled();
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
    expect(r.createTryOnJobIfAffordable).not.toHaveBeenCalled();
  });

  test('rejects when the repository says the user cannot afford it (balance minus credits held by running jobs)', async () => {
    r.createTryOnJobIfAffordable.mockResolvedValue({ ok: false });
    const result = await TryOnService.createJob(base);
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_CREDITS' });
  });

  test('creates a queued single-view job needing 1 credit, with consentAt and a 24h expiry', async () => {
    r.createTryOnJobIfAffordable.mockResolvedValue({ ok: true, job: { id: 'job-1' } });

    const result = await TryOnService.createJob(base);

    expect(result).toEqual({ ok: true, jobId: 'job-1' });
    expect(objectExists).toHaveBeenCalledWith('private-bucket', personKey);
    expect(objectExists).toHaveBeenCalledWith('private-bucket', productKey);
    const [data, creditsNeeded] = r.createTryOnJobIfAffordable.mock.calls[0];
    expect(creditsNeeded).toBe(1);
    expect(data.viewCount).toBe(1);
    expect(data.consentAt).toBeInstanceOf(Date);
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
  });

  test('a 3-view job needs 2 credits up front and stores viewCount 3', async () => {
    r.createTryOnJobIfAffordable.mockResolvedValue({ ok: true, job: { id: 'job-2' } });

    await TryOnService.createJob({ ...base, views: 'multi' });

    const [data, creditsNeeded] = r.createTryOnJobIfAffordable.mock.calls[0];
    expect(creditsNeeded).toBe(2);
    expect(data.viewCount).toBe(3);
  });

  test('never uses the racy balance pre-check any more', async () => {
    r.createTryOnJobIfAffordable.mockResolvedValue({ ok: true, job: { id: 'job-1' } });

    await TryOnService.createJob(base);

    expect(credit.hassufficientCredits).not.toHaveBeenCalled();
  });
});

describe('TryOnService.createJob for a storefront shop', () => {
  const shopId = '8a1f0c52-1111-4222-8333-444455556666';
  const sessionId = 'sess-abc';
  const ownerId = 7;
  const storefrontBase = {
    userId: ownerId,
    personImageKey: `tryon/person/${shopId}/${sessionId}/1-a.jpg`,
    productImageKey: `tryon/product/${shopId}/${sessionId}/1-b.jpg`,
    consent: true,
    storefront: { shopId, sessionId },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (objectExists as jest.Mock).mockResolvedValue(true);
    r.createTryOnJobIfAffordable.mockResolvedValue({ ok: true, job: { id: 'job-s1' } });
  });

  test('accepts keys written for this shop and session and records the shop and session on the job', async () => {
    const result = await TryOnService.createJob(storefrontBase);

    expect(result).toEqual({ ok: true, jobId: 'job-s1' });
    const [data] = r.createTryOnJobIfAffordable.mock.calls[0];
    expect(data).toMatchObject({ userId: ownerId, shopId, sessionId });
  });

  test("refuses another shopper session's photo, even on the same shop", async () => {
    const result = await TryOnService.createJob({
      ...storefrontBase,
      personImageKey: `tryon/person/${shopId}/another-session/1-a.jpg`,
    });

    expect(result).toEqual({ ok: false, reason: 'INVALID_KEY' });
    expect(r.createTryOnJobIfAffordable).not.toHaveBeenCalled();
  });

  test("refuses another shop's keys", async () => {
    const result = await TryOnService.createJob({
      ...storefrontBase,
      productImageKey: `tryon/product/other-shop/${sessionId}/1-b.jpg`,
    });

    expect(result).toEqual({ ok: false, reason: 'INVALID_KEY' });
  });

  test('refuses account-style keys on a storefront job, so a shopper cannot borrow a merchant photo', async () => {
    const result = await TryOnService.createJob({
      ...storefrontBase,
      personImageKey: `tryon/person/u/${ownerId}/1-a.jpg`,
    });

    expect(result).toEqual({ ok: false, reason: 'INVALID_KEY' });
  });

  test.each(['tryon/person/../../x', 'tryon/person/shop/sess/a/b', `tryon/person/${shopId}/${sessionId}/`])(
    'refuses the odd key %p',
    async key => {
      const result = await TryOnService.createJob({ ...storefrontBase, personImageKey: key });
      expect(result).toEqual({ ok: false, reason: 'INVALID_KEY' });
    }
  );

  test('a normal merchant job still uses account-style keys and records no shop', async () => {
    const result = await TryOnService.createJob({
      userId: ownerId,
      personImageKey: `tryon/person/u/${ownerId}/1-a.jpg`,
      productImageKey: `tryon/product/u/${ownerId}/1-b.jpg`,
      consent: true,
    });

    expect(result).toEqual({ ok: true, jobId: 'job-s1' });
    const [data] = r.createTryOnJobIfAffordable.mock.calls[0];
    expect(data.shopId).toBeUndefined();
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
    (findPhotoProblem as jest.Mock).mockResolvedValue(null);
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

  test('checks the prepared photos before spending on the provider', async () => {
    await TryOnService.processJob('job-1');

    expect(findPhotoProblem).toHaveBeenCalledWith({
      personBase64: 'PREPARED',
      personContentType: 'image/jpeg',
      garmentBase64: 'PREPARED',
      garmentContentType: 'image/jpeg',
    });
    const checkedAt = (findPhotoProblem as jest.Mock).mock.invocationCallOrder[0];
    const providerAt = (runTryOn as jest.Mock).mock.invocationCallOrder[0];
    expect(checkedAt).toBeLessThan(providerAt);
  });

  test('a photo with a problem fails the job with that reason, never calls the provider or charges, and still deletes the photo', async () => {
    (findPhotoProblem as jest.Mock).mockResolvedValue('NO_PERSON');

    await TryOnService.processJob('job-1');

    expect(r.markJobFailed).toHaveBeenCalledWith('job-1', 'NO_PERSON');
    expect(runTryOn).not.toHaveBeenCalled();
    expect(generateExtraView).not.toHaveBeenCalled();
    expect(credit.deductCredits).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith('private-bucket', personKey);
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

  test.each([
    ['NO_PERSON', /person/i],
    ['MULTIPLE_PEOPLE', /more than one/i],
    ['PERSON_TOO_SMALL', /shoulders|torso/i],
    ['NOT_CLOTHING', /clothing|garment/i],
  ])('explains a %s failure to the user in plain words and says they were not charged', async (code, pattern) => {
    r.findTryOnJobForUser.mockResolvedValue({
      id: 'job-1',
      status: 'FAILED',
      error: code,
      updatedAt: new Date(),
    } as never);

    const status = await TryOnService.getStatus('job-1', userId);

    expect(status).toMatchObject({ status: 'failed', error: expect.stringMatching(pattern) });
    expect(status).toMatchObject({ error: expect.stringMatching(/not been charged/i) });
  });

  test('never exposes an unknown stored error string to the user', async () => {
    r.findTryOnJobForUser.mockResolvedValue({
      id: 'job-1',
      status: 'FAILED',
      error: 'Error: connect ECONNREFUSED 10.0.0.5:5432',
      updatedAt: new Date(),
    } as never);

    await expect(TryOnService.getStatus('job-1', userId)).resolves.toEqual({
      status: 'failed',
      error: 'Try-on failed. You have not been charged.',
    });
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

describe('TryOnService.getStatusForSession', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (generateDownloadUrl as jest.Mock).mockResolvedValue({ downloadUrl: 'https://signed' });
  });

  test('returns null for a job that belongs to another session or shop', async () => {
    r.findTryOnJobForSession.mockResolvedValue(null);

    await expect(TryOnService.getStatusForSession('job-1', 'shop-1', 'sess-1')).resolves.toBeNull();
    expect(r.findTryOnJobForSession).toHaveBeenCalledWith('job-1', 'shop-1', 'sess-1');
  });

  test('reports a finished job exactly like the account view does', async () => {
    r.findTryOnJobForSession.mockResolvedValue({
      id: 'job-1',
      status: 'DONE',
      resultImageKey: 'tryon/result/front.png',
      sideImageKey: null,
      backImageKey: null,
      viewCount: 1,
      extrasSettledAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(TryOnService.getStatusForSession('job-1', 'shop-1', 'sess-1')).resolves.toEqual({
      status: 'done',
      resultUrl: 'https://signed',
      viewCount: 1,
      extrasPending: false,
    });
  });
});

describe('photo problem codes', () => {
  test('the shared list matches the messages shown to shoppers, so merchant reports and shopper text never drift apart', () => {
    expect([...PHOTO_PROBLEM_CODES].sort()).toEqual(Object.keys(PHOTO_PROBLEM_MESSAGES).sort());
  });
});
