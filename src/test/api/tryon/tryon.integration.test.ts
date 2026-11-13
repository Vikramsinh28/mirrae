/**
 * Database-backed try-on tests. Real routes, service, repository and credit service run against
 * a real Postgres; only the edges are mocked (auth cookie, object storage, the try-on provider).
 *
 * Run by a human against mirrae_test:  npx jest src/test/api/tryon/tryon.integration
 * Refuses to run unless the database name ends in _test, because cleanupDatabase() deletes rows.
 */
import { NextRequest, after } from 'next/server';

import { getAuthUser } from '@/lib/auth/jwt';
import { deleteObject, generateDownloadUrl, objectExists, putObject } from '@/services/external/aws/s3';
import { runTryOn } from '@/services/external/tryon';
import { generateExtraView } from '@/services/external/tryon-views';
import { TryOnService } from '@/services/internal/tryon';
import * as tryOnRepo from '@/services/repositories/tryon-job';
import { cleanupDatabase, createTestUser, disconnectTestDatabase, testPrisma } from '../../setup';

jest.mock('@/lib/auth/jwt', () => ({ getAuthUser: jest.fn(), JWT_KEY: 'auth-token' }));
jest.mock('@/services/external/aws/s3', () => ({
  putObject: jest.fn(),
  deleteObject: jest.fn(),
  objectExists: jest.fn(),
  generateDownloadUrl: jest.fn(),
}));
jest.mock('@/services/external/tryon', () => ({
  runTryOn: jest.fn(),
  TryOnProviderError: class extends Error {},
}));
jest.mock('@/services/external/tryon-views', () => ({ generateExtraView: jest.fn() }));
jest.mock('@/services/internal/tryon-image', () => ({
  prepareTryOnImage: jest.fn().mockResolvedValue({ base64: 'PREPARED', contentType: 'image/jpeg' }),
  TryOnImageError: class extends Error {},
}));
jest.mock('@/services/internal/files/file-upload/file-upload-config', () => ({
  getBucketName: () => 'private-bucket',
}));
jest.mock('next/server', () => ({ ...jest.requireActual('next/server'), after: jest.fn() }));

const authMock = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const afterMock = after as jest.MockedFunction<typeof after>;
const providerMock = runTryOn as jest.MockedFunction<typeof runTryOn>;
const deleteObjectMock = deleteObject as jest.MockedFunction<typeof deleteObject>;
const extraViewMock = generateExtraView as jest.MockedFunction<typeof generateExtraView>;

const STALE_AGE_MS = 10 * 60 * 1000;
const RESULT_KEY = 'tryon/result/u/1/result.png';

type TestUser = Awaited<ReturnType<typeof createTestUser>>;

const personKey = (user: TestUser) => `tryon/person/u/${user.id}/person.jpg`;
const productKey = (user: TestUser) => `tryon/product/u/${user.id}/product.jpg`;

function signInAs(user: TestUser) {
  authMock.mockResolvedValue({
    userId: user.id,
    email: user.email,
    role: 'USER',
    name: user.name,
    isOnboarded: true,
    credits: user.credits,
    plan: 'FREE',
    isOverdue: false,
    googleId: user.googleId ?? '',
  } as never);
}

async function postCreate(user: TestUser, overrides: Record<string, unknown> = {}) {
  const { POST } = await import('@/app/api/tryon/create/route');
  return POST(
    new NextRequest('http://localhost/api/tryon/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        personImageKey: personKey(user),
        productImageKey: productKey(user),
        consent: true,
        ...overrides,
      }),
    })
  );
}

async function getStatus(jobId: string) {
  const { GET } = await import('@/app/api/tryon/status/route');
  return GET(new NextRequest(`http://localhost/api/tryon/status?jobId=${jobId}`));
}

/** Creates a job through the real create route and returns its id. */
async function createJobVia(user: TestUser, overrides: Record<string, unknown> = {}): Promise<string> {
  signInAs(user);
  const response = await postCreate(user, overrides);
  expect(response.status).toBe(202);
  return (await response.json()).data.jobId;
}

const creditsOf = async (userId: number) =>
  (await testPrisma.user.findUniqueOrThrow({ where: { id: userId } })).credits;

describe('Try-on API against a real database', () => {
  beforeAll(() => {
    const databaseName = new URL(process.env.POSTGRES_URL ?? 'postgresql://x/none').pathname.slice(1);
    if (!databaseName.endsWith('_test')) {
      throw new Error(`Refusing to run: database "${databaseName}" must end in _test (set TEST_POSTGRES_URL)`);
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanupDatabase();
    (objectExists as jest.Mock).mockResolvedValue(true);
    (generateDownloadUrl as jest.Mock).mockResolvedValue({ downloadUrl: 'https://signed.example/img' });
    (putObject as jest.Mock).mockResolvedValue({ key: RESULT_KEY });
    deleteObjectMock.mockResolvedValue(undefined as never);
    providerMock.mockResolvedValue({ image: { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' } });
    extraViewMock.mockResolvedValue({ bytes: new Uint8Array([4, 5, 6]), contentType: 'image/png' });
    // A fresh Response per call: a body can be read only once.
    global.fetch = jest.fn().mockImplementation(
      async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })
    );
  });

  afterAll(async () => {
    await cleanupDatabase();
    await disconnectTestDatabase();
  });

  test('create stores a queued job with consent recorded and charges nothing yet', async () => {
    const user = await createTestUser({ credits: 5 });

    const jobId = await createJobVia(user);

    const job = await testPrisma.tryOnJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job).toMatchObject({ userId: user.id, status: 'QUEUED', chargedAt: null });
    expect(job.consentAt).toBeInstanceOf(Date);
    expect(job.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(await creditsOf(user.id)).toBe(5);
  });

  test('a successful try-on charges exactly one credit and deletes the shopper photo', async () => {
    const user = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(user);

    await (afterMock.mock.calls[0][0] as () => Promise<void>)();

    const job = await testPrisma.tryOnJob.findUniqueOrThrow({ where: { id: jobId } });
    const history = await testPrisma.creditHistory.findMany({ where: { userId: user.id } });
    expect(job).toMatchObject({ status: 'DONE', resultImageKey: RESULT_KEY });
    expect(job.chargedAt).not.toBeNull();
    expect(await creditsOf(user.id)).toBe(4);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ operation: 'TRYON', objectId: jobId, amount: -1, balanceAfter: 4 });
    expect(deleteObjectMock).toHaveBeenCalledWith('private-bucket', personKey(user));
  });

  test('three simultaneous workers run the provider once and charge once', async () => {
    const user = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(user);

    await Promise.all([1, 2, 3].map(() => TryOnService.processJob(jobId)));

    expect(providerMock).toHaveBeenCalledTimes(1);
    expect(await creditsOf(user.id)).toBe(4);
    expect(await testPrisma.creditHistory.count({ where: { userId: user.id } })).toBe(1);
  });

  test('the charge claim succeeds for exactly one of many concurrent callers', async () => {
    const user = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(user);
    await testPrisma.tryOnJob.update({ where: { id: jobId }, data: { status: 'DONE' } });

    const claims = await Promise.all(Array.from({ length: 8 }, () => tryOnRepo.claimJobCharge(jobId)));

    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  test('a provider failure fails the job, charges nothing and still deletes the photo', async () => {
    const user = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(user);
    providerMock.mockRejectedValue(new Error('provider down'));

    await TryOnService.processJob(jobId);

    const job = await testPrisma.tryOnJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job).toMatchObject({ status: 'FAILED', chargedAt: null });
    expect(await creditsOf(user.id)).toBe(5);
    expect(await testPrisma.creditHistory.count({ where: { userId: user.id } })).toBe(0);
    expect(deleteObjectMock).toHaveBeenCalledWith('private-bucket', personKey(user));
  });

  test('a stale processing job is failed on status check and can never be revived or charged', async () => {
    const user = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(user);
    await testPrisma.tryOnJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', updatedAt: new Date(Date.now() - STALE_AGE_MS) },
    });

    const status = await TryOnService.getStatus(jobId, user.id);
    const revived = await tryOnRepo.markJobDone(jobId, RESULT_KEY, true);

    expect(status).toMatchObject({ status: 'failed' });
    expect(revived).toBe(false);
    expect(await creditsOf(user.id)).toBe(5);
  });

  test("another user cannot read someone else's job", async () => {
    const owner = await createTestUser({ credits: 5 });
    const intruder = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(owner);

    signInAs(intruder);
    const response = await getStatus(jobId);

    expect(response.status).toBe(404);
  });

  test('create is refused with 402 and stores no job when the user has no credits', async () => {
    const user = await createTestUser({ credits: 0 });
    signInAs(user);

    const response = await postCreate(user);

    expect(response.status).toBe(402);
    expect(await testPrisma.tryOnJob.count()).toBe(0);
    expect(afterMock).not.toHaveBeenCalled();
  });

  test('create is refused with 400 and stores no job without consent', async () => {
    const user = await createTestUser({ credits: 5 });
    signInAs(user);

    const response = await postCreate(user, { consent: false });

    expect(response.status).toBe(400);
    expect(await testPrisma.tryOnJob.count()).toBe(0);
  });

  test('a job row cannot be created without a consent timestamp', async () => {
    const user = await createTestUser({ credits: 5 });

    const insertWithoutConsent = testPrisma.tryOnJob.create({
      data: {
        userId: user.id,
        personImageKey: personKey(user),
        productImageKey: productKey(user),
        expiresAt: new Date(),
      } as never,
    });

    await expect(insertWithoutConsent).rejects.toThrow();
  });
  test('a 3-view try-on stores side and back, settles, and charges exactly 2 credits', async () => {
    const user = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(user, { views: 'multi' });

    await TryOnService.processJob(jobId);

    const job = await testPrisma.tryOnJob.findUniqueOrThrow({ where: { id: jobId } });
    const history = await testPrisma.creditHistory.findMany({ where: { userId: user.id } });
    expect(job).toMatchObject({ status: 'DONE', viewCount: 3 });
    expect(job.sideImageKey).toBe(RESULT_KEY);
    expect(job.backImageKey).toBe(RESULT_KEY);
    expect(job.extrasSettledAt).not.toBeNull();
    expect(await creditsOf(user.id)).toBe(3);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ operation: 'TRYON', objectId: jobId, amount: -2, balanceAfter: 3 });
  });

  test('a 3-view try-on whose back view fails is delivered and charged only 1 credit', async () => {
    const user = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(user, { views: 'multi' });
    extraViewMock.mockImplementation(async ({ view }) => {
      if (view === 'back') throw new Error('rate limited');
      return { bytes: new Uint8Array([4]), contentType: 'image/png' };
    });

    await TryOnService.processJob(jobId);

    const job = await testPrisma.tryOnJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job).toMatchObject({ status: 'DONE', backImageKey: null });
    expect(job.sideImageKey).toBe(RESULT_KEY);
    expect(await creditsOf(user.id)).toBe(4);
  });

  test('the charge cannot be claimed until the extra views are settled, then exactly once', async () => {
    const user = await createTestUser({ credits: 5 });
    const jobId = await createJobVia(user, { views: 'multi' });
    await testPrisma.tryOnJob.update({ where: { id: jobId }, data: { status: 'DONE' } });

    const early = await tryOnRepo.claimJobCharge(jobId);
    await tryOnRepo.settleExtras(jobId);
    const claims = await Promise.all(Array.from({ length: 6 }, () => tryOnRepo.claimJobCharge(jobId)));

    expect(early).toBe(false);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  test('a 3-view create is refused with 402 when the user has only 1 credit', async () => {
    const user = await createTestUser({ credits: 1 });
    signInAs(user);

    const response = await postCreate(user, { views: 'multi' });

    expect(response.status).toBe(402);
    expect(await testPrisma.tryOnJob.count()).toBe(0);
  });
});
