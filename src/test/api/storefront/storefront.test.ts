/**
 * Route-handler tests for the anonymous storefront API. The service is mocked; these check the HTTP layer:
 * validation, the token header, status codes, what the shopper is told, and CORS.
 */
import { NextRequest, after } from 'next/server';

import { StorefrontService } from '@/services/internal/storefront';
import { TryOnService } from '@/services/internal/tryon';

jest.mock('@/services/internal/storefront', () => ({
  StorefrontService: { openSession: jest.fn(), uploadPhoto: jest.fn(), startTryOn: jest.fn(), getStatus: jest.fn() },
}));
jest.mock('@/services/internal/tryon', () => ({ TryOnService: { processJob: jest.fn() } }));
jest.mock('next/server', () => ({ ...jest.requireActual('next/server'), after: jest.fn() }));

const service = StorefrontService as jest.Mocked<typeof StorefrontService>;
const afterMock = after as jest.MockedFunction<typeof after>;
const processJob = TryOnService.processJob as jest.Mock;

const ORIGIN = 'https://www.example.com';
const TOKEN = 'signed.token';
const JOB_ID = '33333333-3333-4333-8333-333333333333';

const json = (url: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('Storefront API routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST /api/storefront/session', () => {
    const url = 'http://localhost/api/storefront/session';
    const post = async (body: unknown, headers: Record<string, string> = {}) => {
      const { POST } = await import('@/app/api/storefront/session/route');
      return POST(json(url, 'POST', body, headers));
    };

    test('returns a token and passes the origin and the real client IP to the service', async () => {
      service.openSession.mockResolvedValue({ ok: true, token: TOKEN, shopName: 'Example Store' });

      const response = await post({ publicKey: 'pk_live_abc' }, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, data: { token: TOKEN, shopName: 'Example Store' } });
      expect(service.openSession).toHaveBeenCalledWith({ publicKey: 'pk_live_abc', origin: ORIGIN, ip: '203.0.113.9' });
    });

    test('lets the calling page read the answer and never caches it', async () => {
      service.openSession.mockResolvedValue({ ok: true, token: TOKEN, shopName: 'S' });

      const response = await post({ publicKey: 'pk_live_abc' });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });

    test.each([
      ['a missing key', {}],
      ['a key without the pk_ prefix', { publicKey: 'sk_live_abc' }],
      ['an oversized key', { publicKey: `pk_${'x'.repeat(200)}` }],
    ])('rejects %s with 400', async (_name, body) => {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(service.openSession).not.toHaveBeenCalled();
    });

    test.each([
      ['UNKNOWN_SHOP', 404],
      ['SHOP_INACTIVE', 403],
      ['ORIGIN_NOT_ALLOWED', 403],
    ] as const)('maps %s to HTTP %i', async (reason, status) => {
      service.openSession.mockResolvedValue({ ok: false, reason });

      const response = await post({ publicKey: 'pk_live_abc' });

      expect(response.status).toBe(status);
      expect((await response.json()).code).toBe(reason);
    });

    test('a rate-limited caller gets 429 with a Retry-After in whole seconds', async () => {
      service.openSession.mockResolvedValue({ ok: false, reason: 'RATE_LIMITED', retryAfterMs: 4200 });

      const response = await post({ publicKey: 'pk_live_abc' });

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('5');
    });

    test('an unexpected error becomes a generic 500 that leaks nothing', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      service.openSession.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

      const response = await post({ publicKey: 'pk_live_abc' });
      const text = JSON.stringify(await response.json());

      expect(response.status).toBe(500);
      expect(text).not.toContain('ECONNREFUSED');
    });
  });

  describe('POST /api/storefront/photo', () => {
    const url = 'http://localhost/api/storefront/photo';
    const post = async (init: { token?: string; contentType?: string; body?: Uint8Array; contentLength?: string }) => {
      const { POST } = await import('@/app/api/storefront/photo/route');
      const headers: Record<string, string> = { origin: ORIGIN, 'content-type': init.contentType ?? 'image/jpeg' };
      if (init.token !== '') headers['x-storefront-token'] = init.token ?? TOKEN;
      if (init.contentLength) headers['content-length'] = init.contentLength;
      return POST(
        new NextRequest(url, { method: 'POST', headers, body: (init.body ?? new Uint8Array([1, 2, 3])) as unknown as BodyInit })
      );
    };

    test('passes the raw photo bytes and the token to the service', async () => {
      service.uploadPhoto.mockResolvedValue({ ok: true, photoKey: 'tryon/person/s/x/1.jpg' });

      const response = await post({ body: new Uint8Array([7, 8, 9]) });

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ photoKey: 'tryon/person/s/x/1.jpg' });
      const call = service.uploadPhoto.mock.calls[0][0];
      expect(call.token).toBe(TOKEN);
      expect(Array.from(call.bytes)).toEqual([7, 8, 9]);
    });

    test('needs the session token header', async () => {
      const response = await post({ token: '' });

      expect(response.status).toBe(401);
      expect(service.uploadPhoto).not.toHaveBeenCalled();
    });

    test('refuses a body that is not an image', async () => {
      const response = await post({ contentType: 'text/html' });

      expect(response.status).toBe(415);
      expect(service.uploadPhoto).not.toHaveBeenCalled();
    });

    test('refuses a photo over 8 MB from its declared length, before reading it', async () => {
      const response = await post({ contentLength: String(9 * 1024 * 1024) });

      expect(response.status).toBe(413);
      expect(service.uploadPhoto).not.toHaveBeenCalled();
    });

    test('refuses a body that grows past 8 MB even when it declares nothing', async () => {
      const response = await post({ body: new Uint8Array(8 * 1024 * 1024 + 1) });

      expect(response.status).toBe(413);
      expect(service.uploadPhoto).not.toHaveBeenCalled();
    });

    test('tells the shopper why a photo was refused', async () => {
      service.uploadPhoto.mockResolvedValue({
        ok: false,
        reason: 'PHOTO_PROBLEM',
        problem: 'NO_PERSON',
        message: 'We could not find a person in your photo.',
      });

      const response = await post({});
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toMatchObject({ code: 'PHOTO_PROBLEM', problem: 'NO_PERSON', message: 'We could not find a person in your photo.' });
    });

    test('maps an unreadable image to 400', async () => {
      service.uploadPhoto.mockResolvedValue({ ok: false, reason: 'INVALID_PHOTO' });
      expect((await post({})).status).toBe(400);
    });
  });

  describe('POST /api/storefront/tryon', () => {
    const url = 'http://localhost/api/storefront/tryon';
    const valid = { photoKey: 'tryon/person/s/x/1.jpg', productImageUrl: 'https://cdn.shopify.com/p.png', consent: true };
    const post = async (body: unknown, headers: Record<string, string> = { 'x-storefront-token': TOKEN }) => {
      const { POST } = await import('@/app/api/storefront/tryon/route');
      return POST(json(url, 'POST', body, headers));
    };

    test('starts the job, answers 202 and processes it after the response', async () => {
      service.startTryOn.mockResolvedValue({ ok: true, jobId: JOB_ID });

      const response = await post({ ...valid, views: 'multi' });

      expect(response.status).toBe(202);
      expect((await response.json()).data).toEqual({ jobId: JOB_ID });
      expect(service.startTryOn).toHaveBeenCalledWith({
        token: TOKEN,
        origin: ORIGIN,
        ip: 'unknown',
        photoKey: valid.photoKey,
        productImageUrl: valid.productImageUrl,
        views: 'multi',
        consent: true,
      });
      expect(processJob).not.toHaveBeenCalled();
      (afterMock.mock.calls[0][0] as () => unknown)();
      expect(processJob).toHaveBeenCalledWith(JOB_ID);
    });

    test('defaults to a single view', async () => {
      service.startTryOn.mockResolvedValue({ ok: true, jobId: JOB_ID });

      await post(valid);

      expect(service.startTryOn).toHaveBeenCalledWith(expect.objectContaining({ views: 'single' }));
    });

    test('needs the session token header', async () => {
      const response = await post(valid, {});

      expect(response.status).toBe(401);
      expect(service.startTryOn).not.toHaveBeenCalled();
    });

    test.each([
      ['consent is false', { ...valid, consent: false }, 'CONSENT_REQUIRED'],
      ['consent is the string "true"', { ...valid, consent: 'true' }, 'CONSENT_REQUIRED'],
      ['consent is missing', { photoKey: valid.photoKey, productImageUrl: valid.productImageUrl }, 'CONSENT_REQUIRED'],
      ['the product url is not a url', { ...valid, productImageUrl: 'not a url' }, 'BAD_REQUEST'],
      ['views is unknown', { ...valid, views: 'ten' }, 'BAD_REQUEST'],
      ['the photo key is empty', { ...valid, photoKey: '' }, 'BAD_REQUEST'],
    ])('rejects the request with 400 when %s', async (_name, body, code) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe(code);
      expect(service.startTryOn).not.toHaveBeenCalled();
      expect(afterMock).not.toHaveBeenCalled();
    });

    test.each(['DAILY_CAP_REACHED', 'INSUFFICIENT_CREDITS'] as const)(
      'tells the shopper only "temporarily unavailable" for %s, never why',
      async reason => {
        service.startTryOn.mockResolvedValue({ ok: false, reason });

        const response = await post(valid);
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.message).toMatch(/temporarily unavailable/i);
        expect(body.message).not.toMatch(/credit|cap|limit|balance/i);
        expect(afterMock).not.toHaveBeenCalled();
      }
    );

    test('maps an unusable product image to 400 and schedules nothing', async () => {
      service.startTryOn.mockResolvedValue({ ok: false, reason: 'INVALID_PRODUCT_IMAGE' });

      const response = await post(valid);

      expect(response.status).toBe(400);
      expect(afterMock).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/storefront/status', () => {
    const get = async (query: string, headers: Record<string, string> = { 'x-storefront-token': TOKEN }) => {
      const { GET } = await import('@/app/api/storefront/status/route');
      return GET(json(`http://localhost/api/storefront/status${query}`, 'GET', undefined, headers));
    };

    test("returns the status of the session's job", async () => {
      service.getStatus.mockResolvedValue({ ok: true, status: { status: 'processing' } });

      const response = await get(`?jobId=${JOB_ID}`);

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ status: 'processing' });
      expect(service.getStatus).toHaveBeenCalledWith({ token: TOKEN, origin: ORIGIN, jobId: JOB_ID });
    });

    test('needs the session token header', async () => {
      expect((await get(`?jobId=${JOB_ID}`, {})).status).toBe(401);
    });

    test('rejects a job id that is not a uuid', async () => {
      const response = await get('?jobId=1%20OR%201=1');

      expect(response.status).toBe(400);
      expect(service.getStatus).not.toHaveBeenCalled();
    });

    test.each([
      ['NOT_FOUND', 404],
      ['INVALID_TOKEN', 401],
      ['ORIGIN_NOT_ALLOWED', 403],
    ] as const)('maps %s to HTTP %i', async (reason, status) => {
      service.getStatus.mockResolvedValue({ ok: false, reason });
      expect((await get(`?jobId=${JOB_ID}`)).status).toBe(status);
    });
  });
});
