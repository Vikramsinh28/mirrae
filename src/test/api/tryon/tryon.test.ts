import { NextRequest, after } from 'next/server';

import { getAuthUser } from '@/lib/auth/jwt';
import { TryOnService } from '@/services/internal/tryon';
import { getUserById } from '@/services/repositories/user';

jest.mock('@/lib/auth/jwt', () => ({
  getAuthUser: jest.fn(),
  JWT_KEY: 'auth-token',
}));

jest.mock('@/services/repositories/user', () => ({
  getUserById: jest.fn(),
}));

jest.mock('@/services/internal/tryon', () => ({
  TryOnService: {
    createJob: jest.fn(),
    getStatus: jest.fn(),
    processJob: jest.fn(),
  },
}));

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  return {
    ...actual,
    after: jest.fn(),
  };
});

const auth = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const userById = getUserById as jest.MockedFunction<typeof getUserById>;
const createJob = TryOnService.createJob as jest.MockedFunction<typeof TryOnService.createJob>;
const getStatus = TryOnService.getStatus as jest.MockedFunction<typeof TryOnService.getStatus>;
const processJob = TryOnService.processJob as jest.MockedFunction<typeof TryOnService.processJob>;
const afterMock = after as jest.MockedFunction<typeof after>;

const user = {
  id: 7,
  email: 'tryon@example.com',
  name: 'Try User',
  role: 'USER',
};

function mockSignedInUser(who: typeof user = user) {
  auth.mockResolvedValue({
    userId: who.id,
    email: who.email,
    role: who.role,
    name: who.name,
    isOnboarded: true,
    credits: 10,
    plan: 'FREE',
    isOverdue: false,
    googleId: `google_${who.id}`,
  });
  userById.mockResolvedValue(who as never);
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('Try-on API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignedInUser();
  });

  test('POST /api/tryon/create creates a job on the happy path', async () => {
    const { POST } = await import('@/app/api/tryon/create/route');
    createJob.mockResolvedValue({ ok: true, jobId: '11111111-1111-4111-8111-111111111111' });

    const response = await POST(
      jsonRequest('http://localhost/api/tryon/create', 'POST', {
        personImageKey: `tryon/person/u/${user.id}/person.jpg`,
        productImageKey: `tryon/product/u/${user.id}/product.jpg`,
        consent: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      success: true,
      data: { jobId: '11111111-1111-4111-8111-111111111111' },
    });
    expect(createJob).toHaveBeenCalledWith({
      userId: user.id,
      personImageKey: `tryon/person/u/${user.id}/person.jpg`,
      productImageKey: `tryon/product/u/${user.id}/product.jpg`,
      views: 'single',
      consent: true,
    });
  });

  test('POST /api/tryon/create rejects missing consent', async () => {
    const { POST } = await import('@/app/api/tryon/create/route');

    const response = await POST(
      jsonRequest('http://localhost/api/tryon/create', 'POST', {
        personImageKey: `tryon/person/u/${user.id}/person.jpg`,
        productImageKey: `tryon/product/u/${user.id}/product.jpg`,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(createJob).not.toHaveBeenCalled();
  });

  test('GET /api/tryon/status returns 404 for another user\'s job', async () => {
    const { GET } = await import('@/app/api/tryon/status/route');
    getStatus.mockResolvedValue(null);

    const jobId = '22222222-2222-4222-8222-222222222222';
    const response = await GET(new NextRequest(`http://localhost/api/tryon/status?jobId=${jobId}`));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(getStatus).toHaveBeenCalledWith(jobId, user.id);
  });

  describe('POST /api/tryon/create', () => {
    const url = 'http://localhost/api/tryon/create';
    const validBody = {
      personImageKey: `tryon/person/u/${user.id}/person.jpg`,
      productImageKey: `tryon/product/u/${user.id}/product.jpg`,
      consent: true,
    };
    const jobId = '33333333-3333-4333-8333-333333333333';

    const post = async (body?: unknown) => {
      const { POST } = await import('@/app/api/tryon/create/route');
      return POST(jsonRequest(url, 'POST', body));
    };

    test('schedules processJob for the created job after the response', async () => {
      createJob.mockResolvedValue({ ok: true, jobId });

      await post(validBody);

      expect(afterMock).toHaveBeenCalledTimes(1);
      expect(processJob).not.toHaveBeenCalled();
      const scheduled = afterMock.mock.calls[0][0] as () => unknown;
      scheduled();
      expect(processJob).toHaveBeenCalledWith(jobId);
    });

    test('returns 401 and creates nothing when the request is unauthenticated', async () => {
      auth.mockResolvedValue(null as never);
      userById.mockResolvedValue(null as never);

      const response = await post(validBody);

      expect(response.status).toBe(401);
      expect(createJob).not.toHaveBeenCalled();
      expect(afterMock).not.toHaveBeenCalled();
    });

    test.each([
      ['consent is false', { ...validBody, consent: false }],
      ['consent is the string "true"', { ...validBody, consent: 'true' }],
      ['personImageKey is missing', { productImageKey: validBody.productImageKey, consent: true }],
      ['productImageKey is empty', { ...validBody, productImageKey: '' }],
      ['an image key exceeds 512 characters', { ...validBody, personImageKey: 'k'.repeat(513) }],
    ])('rejects the request with 400 when %s', async (_name, body) => {
      const response = await post(body);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(createJob).not.toHaveBeenCalled();
      expect(afterMock).not.toHaveBeenCalled();
    });

    test('rejects a body that is not valid JSON with 400', async () => {
      const { POST } = await import('@/app/api/tryon/create/route');

      const response = await POST(
        new NextRequest(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{not json',
        })
      );

      expect(response.status).toBe(400);
      expect(createJob).not.toHaveBeenCalled();
    });

    test('returns 402 and schedules nothing when the user has insufficient credits', async () => {
      createJob.mockResolvedValue({ ok: false, reason: 'INSUFFICIENT_CREDITS' });

      const response = await post(validBody);

      expect(response.status).toBe(402);
      expect(afterMock).not.toHaveBeenCalled();
    });

    test('passes views "multi" through to the service', async () => {
      createJob.mockResolvedValue({ ok: true, jobId });

      const response = await post({ ...validBody, views: 'multi' });

      expect(response.status).toBe(202);
      expect(createJob).toHaveBeenCalledWith(expect.objectContaining({ views: 'multi' }));
    });

    test('rejects an unknown views value with 400', async () => {
      const response = await post({ ...validBody, views: 'ten' });

      expect(response.status).toBe(400);
      expect(createJob).not.toHaveBeenCalled();
    });

    test('the 402 message says 2 credits for a 3-view try-on and 1 for a single view', async () => {
      createJob.mockResolvedValue({ ok: false, reason: 'INSUFFICIENT_CREDITS' });

      const multi = await (await post({ ...validBody, views: 'multi' })).json();
      const single = await (await post(validBody)).json();

      expect(JSON.stringify(multi)).toContain('at least 2 credits');
      expect(JSON.stringify(single)).toContain('at least 1 credit ');
    });

    test.each(['INVALID_KEY', 'CONSENT_REQUIRED'] as const)(
      'returns 400 and schedules nothing when the service reports %s',
      async reason => {
        createJob.mockResolvedValue({ ok: false, reason });

        const response = await post(validBody);

        expect(response.status).toBe(400);
        expect(afterMock).not.toHaveBeenCalled();
      }
    );

    test('returns 500 without leaking the error when the service throws', async () => {
      createJob.mockRejectedValue(new Error('db connection string secret'));

      const response = await post(validBody);
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).not.toContain('secret');
      expect(afterMock).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/tryon/status', () => {
    const jobId = '44444444-4444-4444-8444-444444444444';

    const get = async (query: string) => {
      const { GET } = await import('@/app/api/tryon/status/route');
      return GET(new NextRequest(`http://localhost/api/tryon/status${query}`));
    };

    test('returns the status of the signed-in user\'s job', async () => {
      getStatus.mockResolvedValue({
        status: 'done',
        resultUrl: 'https://cdn.example.com/r.png',
        viewCount: 1,
        extrasPending: false,
      });

      const response = await get(`?jobId=${jobId}`);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toMatchObject({
        success: true,
        data: { status: 'done', resultUrl: 'https://cdn.example.com/r.png' },
      });
      expect(getStatus).toHaveBeenCalledWith(jobId, user.id);
    });

    test('returns 401 without looking up the job when unauthenticated', async () => {
      auth.mockResolvedValue(null as never);
      userById.mockResolvedValue(null as never);

      const response = await get(`?jobId=${jobId}`);

      expect(response.status).toBe(401);
      expect(getStatus).not.toHaveBeenCalled();
    });

    test.each([
      ['jobId is missing', ''],
      ['jobId is not a uuid', '?jobId=not-a-uuid'],
    ])('returns 400 without looking up the job when %s', async (_name, query) => {
      const response = await get(query);

      expect(response.status).toBe(400);
      expect(getStatus).not.toHaveBeenCalled();
    });

    test('returns 500 when the service throws', async () => {
      getStatus.mockRejectedValue(new Error('boom'));

      const response = await get(`?jobId=${jobId}`);

      expect(response.status).toBe(500);
    });
  });
});
