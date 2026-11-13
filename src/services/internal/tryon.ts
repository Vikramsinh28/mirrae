import {
  deleteObject,
  generateDownloadUrl,
  objectExists,
  putObject,
} from '@/services/external/aws/s3';
import { runTryOn, type TryOnImage } from '@/services/external/tryon';
import { findPhotoProblem, type PhotoProblem } from '@/services/external/tryon-check';
import { generateExtraView, type ExtraView } from '@/services/external/tryon-views';
import { getBucketName } from '@/services/internal/files/file-upload/file-upload-config';
import * as repo from '@/services/repositories/tryon-job';
import { CreditService } from './credit';
import { prepareTryOnImage, type PreparedTryOnImage } from './tryon-image';

const CREDITS_SINGLE_VIEW = 1;
// 3 views (front + side + back) cost 2 credits; if an extra view fails the shopper pays only 1.
const CREDITS_FULL_SET = 2;
const VIEW_COUNT = { single: 1, multi: 3 } as const;
const EXTRA_VIEWS: readonly ExtraView[] = ['side', 'back'];

const JOB_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_JOB_MS = 3 * 60 * 1000;
const MAX_RESULT_BYTES = 16 * 1024 * 1024;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const INPUT_DOWNLOAD_TIMEOUT_MS = 15_000;
const GENERIC_FAILURE = 'Try-on failed. You have not been charged.';

// Stored in TryOnJob.error as the problem code; mapped to these messages when the status is read, so no
// internal error text can ever reach the shopper.
const PHOTO_PROBLEM_MESSAGES: Record<PhotoProblem, string> = {
  NO_PERSON:
    "We couldn't find a person in your photo. Upload a clear photo of yourself, standing and facing the camera. You have not been charged.",
  MULTIPLE_PEOPLE:
    'Your photo has more than one person in it. Upload a photo with only you in it. You have not been charged.',
  PERSON_TOO_SMALL:
    'You are too small or cut off in your photo. Upload a photo that shows at least your shoulders and torso. You have not been charged.',
  NOT_CLOTHING:
    "The product image doesn't show a piece of clothing. Upload a clear photo of the garment. You have not been charged.",
};

const isPhotoProblem = (value: string | null): value is PhotoProblem =>
  value !== null && Object.hasOwn(PHOTO_PROBLEM_MESSAGES, value);

const failureMessage = (storedError: string | null) =>
  isPhotoProblem(storedError) ? PHOTO_PROBLEM_MESSAGES[storedError] : GENERIC_FAILURE;

class PhotoRejectedError extends Error {
  constructor(readonly problem: PhotoProblem) {
    super(`Photo rejected: ${problem}`);
    this.name = 'PhotoRejectedError';
  }
}

export type TryOnViews = keyof typeof VIEW_COUNT;

export type CreateJobResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: 'CONSENT_REQUIRED' | 'INVALID_KEY' | 'INSUFFICIENT_CREDITS' };

export type TryOnStatusResult =
  | { status: 'queued' | 'processing' }
  | {
      status: 'done';
      resultUrl: string;
      sideUrl?: string;
      backUrl?: string;
      viewCount: number;
      /** True while side/back views are still being generated. */
      extrasPending: boolean;
    }
  | { status: 'failed'; error: string };

interface FrontViewResult {
  image: TryOnImage;
  garment: PreparedTryOnImage;
}

type ProcessableJob = NonNullable<Awaited<ReturnType<typeof repo.findTryOnJob>>>;

const isOwnedKey = (key: string, kind: 'person' | 'product', userId: number) =>
  new RegExp(`^tryon/${kind}/[^/]+/${userId}/[^/]+$`).test(key);

const privateBucket = () => getBucketName('private');

const signedUrl = async (key: string) => (await generateDownloadUrl(privateBucket(), key)).downloadUrl;

const signedUrlOrUndefined = async (key: string | null) => (key ? signedUrl(key) : undefined);

const creditsNeeded = (views: TryOnViews) => (views === 'multi' ? CREDITS_FULL_SET : CREDITS_SINGLE_VIEW);

/** Downloads one stored photo and normalises it (orientation, bars, size, JPEG) for the provider. */
async function loadPreparedImage(key: string): Promise<PreparedTryOnImage> {
  const response = await fetch(await signedUrl(key), { signal: AbortSignal.timeout(INPUT_DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error('Could not read input image');

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_INPUT_BYTES) throw new Error('Input image too large');
  return prepareTryOnImage(bytes);
}

function assertValidResultImage({ bytes, contentType }: TryOnImage) {
  if (!contentType.startsWith('image/') || bytes.byteLength === 0) throw new Error('Result is not an image');
  if (bytes.byteLength > MAX_RESULT_BYTES) throw new Error('Result image too large');
}

async function deleteShopperPhoto(key: string) {
  try {
    await deleteObject(privateBucket(), key);
  } catch (error) {
    // Lifecycle rule on tryon/ (24h) is the backstop
    console.error('Failed to delete shopper photo', { key, error });
  }
}

async function chargeOnce(job: { id: string; userId: number }, amount: number) {
  if (!(await repo.claimJobCharge(job.id))) return;

  const charge = await CreditService.deductCredits({
    userId: job.userId,
    amount,
    operation: 'TRYON',
    objectId: job.id,
    description: 'Virtual try-on',
  });
  if (!charge.success) {
    // Result is still delivered; reconcile manually via the logged job id
    console.warn('Try-on charge failed after successful generation', { jobId: job.id, error: charge.error });
  }
}

/**
 * Generates and stores the front view. Never throws: on any failure the job is marked failed (never charged)
 * and null is returned. The shopper photo is always deleted here, before any slow extra view starts.
 */
async function generateFrontView(job: ProcessableJob): Promise<FrontViewResult | null> {
  try {
    const [person, garment] = await Promise.all([
      loadPreparedImage(job.personImageKey),
      loadPreparedImage(job.productImageKey),
    ]);

    const problem = await findPhotoProblem({
      personBase64: person.base64,
      personContentType: person.contentType,
      garmentBase64: garment.base64,
      garmentContentType: garment.contentType,
    });
    if (problem) throw new PhotoRejectedError(problem);

    const { image } = await runTryOn({ personImageBase64: person.base64, productImageBase64: garment.base64 });
    assertValidResultImage(image);
    const { key } = await putObject('TryOnResult', 'u', job.userId, image.contentType, image.bytes);

    const isSingleView = job.viewCount === VIEW_COUNT.single;
    if (!(await repo.markJobDone(job.id, key, isSingleView))) {
      // Job was failed as stale while we worked: discard the result, never charge
      await deleteObject(privateBucket(), key).catch(() => undefined);
      return null;
    }
    return { image, garment };
  } catch (error) {
    if (error instanceof PhotoRejectedError) {
      await repo.markJobFailed(job.id, error.problem);
    } else {
      console.error('Try-on job failed', { jobId: job.id, error });
      await repo.markJobFailed(job.id, GENERIC_FAILURE);
    }
    return null;
  } finally {
    await deleteShopperPhoto(job.personImageKey);
  }
}

/** Best effort: one extra view failing never fails the job. Returns whether the view was delivered. */
async function generateOneExtraView(job: ProcessableJob, view: ExtraView, front: FrontViewResult): Promise<boolean> {
  try {
    const extra = await generateExtraView({
      view,
      frontImage: front.image,
      garmentBase64: front.garment.base64,
      garmentContentType: front.garment.contentType,
    });
    assertValidResultImage(extra);
    const { key } = await putObject('TryOnResult', 'u', job.userId, extra.contentType, extra.bytes);
    await repo.saveExtraView(job.id, view, key);
    return true;
  } catch (error) {
    console.error('Try-on extra view failed', { jobId: job.id, view, error });
    return false;
  }
}

async function generateExtraViews(job: ProcessableJob, front: FrontViewResult): Promise<number> {
  const results = await Promise.all(EXTRA_VIEWS.map(view => generateOneExtraView(job, view, front)));
  try {
    await repo.settleExtras(job.id);
  } catch (error) {
    // Unsettled means the charge claim cannot succeed: the shopper keeps the views for free (accepted).
    console.error('Failed to settle try-on extra views', { jobId: job.id, error });
  }
  return results.filter(Boolean).length;
}

export class TryOnService {
  static async createJob(input: {
    userId: number;
    personImageKey: string;
    productImageKey: string;
    consent: boolean;
    views?: TryOnViews;
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

    const views = input.views ?? 'single';
    if (!(await CreditService.hassufficientCredits(input.userId, creditsNeeded(views)))) {
      return { ok: false, reason: 'INSUFFICIENT_CREDITS' };
    }

    const now = new Date();
    const job = await repo.createTryOnJob({
      userId: input.userId,
      personImageKey: input.personImageKey,
      productImageKey: input.productImageKey,
      viewCount: VIEW_COUNT[views],
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

    const front = await generateFrontView(job);
    if (!front) return;

    // Known/accepted: a hard process crash between DONE and the charge below loses the charge.
    const extrasDelivered = job.viewCount > VIEW_COUNT.single ? await generateExtraViews(job, front) : 0;
    const fullSetDelivered = extrasDelivered === EXTRA_VIEWS.length;
    await chargeOnce(job, fullSetDelivered ? CREDITS_FULL_SET : CREDITS_SINGLE_VIEW);
  }

  static async getStatus(jobId: string, userId: number): Promise<TryOnStatusResult | null> {
    const job = await repo.findTryOnJobForUser(jobId, userId);
    if (!job) return null;

    const staleBefore = new Date(Date.now() - STALE_JOB_MS);

    if (job.status === 'DONE' && job.resultImageKey) {
      const [resultUrl, sideUrl, backUrl] = await Promise.all([
        signedUrl(job.resultImageKey),
        signedUrlOrUndefined(job.sideImageKey),
        signedUrlOrUndefined(job.backImageKey),
      ]);
      // A crashed worker leaves extras unsettled forever: stop reporting them as pending once the job is stale.
      const extrasPending = job.viewCount > VIEW_COUNT.single && !job.extrasSettledAt && job.updatedAt >= staleBefore;
      return {
        status: 'done',
        resultUrl,
        ...(sideUrl ? { sideUrl } : {}),
        ...(backUrl ? { backUrl } : {}),
        viewCount: job.viewCount,
        extrasPending,
      };
    }
    if (job.status === 'FAILED') return { status: 'failed', error: failureMessage(job.error) };

    if (job.updatedAt < staleBefore && (await repo.failStaleJob(job.id, staleBefore, GENERIC_FAILURE))) {
      return { status: 'failed', error: GENERIC_FAILURE };
    }
    return { status: job.status === 'QUEUED' ? 'queued' : 'processing' };
  }
}
