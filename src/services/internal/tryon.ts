import {
  deleteObject,
  generateDownloadUrl,
  objectExists,
  putObject,
} from '@/services/external/aws/s3';
import { runTryOn } from '@/services/external/tryon';
import { getBucketName } from '@/services/internal/files/file-upload/file-upload-config';
import * as repo from '@/services/repositories/tryon-job';
import { CreditService } from './credit';

const TRYON_CREDIT_COST = 1;
const JOB_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_JOB_MS = 3 * 60 * 1000;
const MAX_RESULT_BYTES = 16 * 1024 * 1024;
const RESULT_DOWNLOAD_TIMEOUT_MS = 30_000;
const GENERIC_FAILURE = 'Try-on failed. You have not been charged.';

export type CreateJobResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: 'CONSENT_REQUIRED' | 'INVALID_KEY' | 'INSUFFICIENT_CREDITS' };

export type TryOnStatusResult =
  | { status: 'queued' | 'processing' }
  | { status: 'done'; resultUrl: string }
  | { status: 'failed'; error: string };

const isOwnedKey = (key: string, kind: 'person' | 'product', userId: number) =>
  new RegExp(`^tryon/${kind}/[^/]+/${userId}/[^/]+$`).test(key);

const privateBucket = () => getBucketName('private');

const signedUrl = async (key: string) => (await generateDownloadUrl(privateBucket(), key)).downloadUrl;

async function fetchResultImage(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (new URL(url).protocol !== 'https:') throw new Error('Result URL must be https');

  const response = await fetch(url, { signal: AbortSignal.timeout(RESULT_DOWNLOAD_TIMEOUT_MS) });
  const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!response.ok || !contentType.startsWith('image/')) throw new Error('Result is not an image');

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_RESULT_BYTES) throw new Error('Result image too large');
  return { bytes, contentType };
}

async function deleteShopperPhoto(key: string) {
  try {
    await deleteObject(privateBucket(), key);
  } catch (error) {
    // Lifecycle rule on tryon/ (24h) is the backstop
    console.error('Failed to delete shopper photo', { key, error });
  }
}

async function chargeOnce(job: { id: string; userId: number }) {
  if (!(await repo.claimJobCharge(job.id))) return;

  const charge = await CreditService.deductCredits({
    userId: job.userId,
    amount: TRYON_CREDIT_COST,
    operation: 'TRYON',
    objectId: job.id,
    description: 'Virtual try-on',
  });
  if (!charge.success) {
    // Result is still delivered; reconcile manually via the logged job id
    console.warn('Try-on charge failed after successful generation', { jobId: job.id, error: charge.error });
  }
}

export class TryOnService {
  static async createJob(input: {
    userId: number;
    personImageKey: string;
    productImageKey: string;
    consent: boolean;
  }): Promise<CreateJobResult> {
    // TODO Stage 2: rate-limit unauthenticated storefront try-ons
    if (!input.consent) return { ok: false, reason: 'CONSENT_REQUIRED' };

    if (
      !isOwnedKey(input.personImageKey, 'person', input.userId) ||
      !isOwnedKey(input.productImageKey, 'product', input.userId)
    ) {
      return { ok: false, reason: 'INVALID_KEY' };
    }

    const bucket = privateBucket();
    const [personExists, productExists] = await Promise.all([
      objectExists(bucket, input.personImageKey),
      objectExists(bucket, input.productImageKey),
    ]);
    if (!personExists || !productExists) {
      return { ok: false, reason: 'INVALID_KEY' };
    }

    if (!(await CreditService.hassufficientCredits(input.userId, TRYON_CREDIT_COST))) {
      return { ok: false, reason: 'INSUFFICIENT_CREDITS' };
    }

    const now = new Date();
    const job = await repo.createTryOnJob({
      userId: input.userId,
      personImageKey: input.personImageKey,
      productImageKey: input.productImageKey,
      consentAt: now,
      expiresAt: new Date(now.getTime() + JOB_TTL_MS),
    });
    return { ok: true, jobId: job.id };
  }

  /** Runs generation for a queued job. Never throws; failures mark the job failed without charging. */
  static async processJob(jobId: string): Promise<void> {
    if (!(await repo.claimQueuedJob(jobId))) return;

    const job = await repo.findTryOnJob(jobId);
    if (!job) return;

    try {
      const [personImageUrl, productImageUrl] = await Promise.all([
        signedUrl(job.personImageKey),
        signedUrl(job.productImageKey),
      ]);

      const { resultUrl } = await runTryOn({ personImageUrl, productImageUrl });
      const { bytes, contentType } = await fetchResultImage(resultUrl);
      const { key } = await putObject('TryOnResult', 'u', job.userId, contentType, bytes);

      if (!(await repo.markJobDone(job.id, key))) {
        // Job was failed as stale while we worked: discard the result, never charge
        await deleteObject(privateBucket(), key).catch(() => undefined);
        return;
      }
      // Known/accepted: a hard process crash between DONE and the charge below loses one credit.
      await chargeOnce(job);
    } catch (error) {
      console.error('Try-on job failed', { jobId, error });
      await repo.markJobFailed(jobId, GENERIC_FAILURE);
    } finally {
      await deleteShopperPhoto(job.personImageKey);
    }
  }

  static async getStatus(jobId: string, userId: number): Promise<TryOnStatusResult | null> {
    const job = await repo.findTryOnJobForUser(jobId, userId);
    if (!job) return null;

    if (job.status === 'DONE' && job.resultImageKey) {
      return { status: 'done', resultUrl: await signedUrl(job.resultImageKey) };
    }
    if (job.status === 'FAILED') return { status: 'failed', error: GENERIC_FAILURE };

    const staleBefore = new Date(Date.now() - STALE_JOB_MS);
    if (job.updatedAt < staleBefore && (await repo.failStaleJob(job.id, staleBefore, GENERIC_FAILURE))) {
      return { status: 'failed', error: GENERIC_FAILURE };
    }
    return { status: job.status === 'QUEUED' ? 'queued' : 'processing' };
  }
}
