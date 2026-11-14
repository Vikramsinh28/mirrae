import { createApi, WidgetApiError, type ApiDeps } from './api';

const CONFIG = { apiBase: 'https://app.mirrae.test', publicKey: 'pk_live_abc' };
const JOB = '33333333-3333-4333-8333-333333333333';

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const ok = (data: unknown, status = 200) => reply(status, { success: true, data });
const fail = (status: number, code: string, extra: object = {}, headers: Record<string, string> = {}) =>
  reply(status, { success: false, code, message: 'server words', ...extra }, headers);

function setup() {
  const fetchMock = jest.fn();
  const sleeps: number[] = [];
  let clock = 0;
  const deps: ApiDeps = {
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async ms => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
  };
  return { api: createApi(CONFIG, deps), fetchMock, sleeps, advance: (ms: number) => (clock += ms) };
}

const urlOf = (call: unknown[]) => String(call[0]);
const initOf = (call: unknown[]) => call[1] as RequestInit & { headers: Record<string, string> };
const sessionOk = () => ok({ token: 'tok-1', shopName: 'Shop' });

describe('session handling', () => {
  test('opens a session once and sends its token on every later call', async () => {
    const { api, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(sessionOk())
      .mockResolvedValueOnce(ok({ jobId: JOB }, 202))
      .mockResolvedValueOnce(ok({ jobId: JOB }, 202));

    await api.startTryOn({ photoKey: 'k', productImageUrl: 'https://x.test/p.jpg', views: 'multi' });
    await api.startTryOn({ photoKey: 'k', productImageUrl: 'https://x.test/p.jpg', views: 'multi' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urlOf(fetchMock.mock.calls[0])).toBe('https://app.mirrae.test/api/storefront/session');
    expect(JSON.parse(String(initOf(fetchMock.mock.calls[0]).body))).toEqual({ publicKey: 'pk_live_abc' });
    expect(initOf(fetchMock.mock.calls[1]).headers['X-Storefront-Token']).toBe('tok-1');
    expect(initOf(fetchMock.mock.calls[2]).headers['X-Storefront-Token']).toBe('tok-1');
  });

  test('two calls that start together share one session request', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockImplementation(async () => ok({ jobId: JOB }, 202));

    await Promise.all([
      api.startTryOn({ photoKey: 'a', productImageUrl: 'https://x.test/p.jpg', views: 'single' }),
      api.startTryOn({ photoKey: 'b', productImageUrl: 'https://x.test/p.jpg', views: 'single' }),
    ]);

    expect(fetchMock.mock.calls.filter(call => urlOf(call).endsWith('/session'))).toHaveLength(1);
  });

  test('an expired token opens a fresh session and retries the call once', async () => {
    const { api, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(sessionOk())
      .mockResolvedValueOnce(fail(401, 'INVALID_TOKEN'))
      .mockResolvedValueOnce(ok({ token: 'tok-2', shopName: 'Shop' }))
      .mockResolvedValueOnce(ok({ jobId: JOB }, 202));

    await expect(api.startTryOn({ photoKey: 'k', productImageUrl: 'https://x.test/p.jpg', views: 'multi' })).resolves.toEqual({ jobId: JOB });

    expect(initOf(fetchMock.mock.calls[3]).headers['X-Storefront-Token']).toBe('tok-2');
  });

  test('gives up when the retry also says the token is invalid, instead of looping', async () => {
    const { api, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(sessionOk())
      .mockResolvedValueOnce(fail(401, 'INVALID_TOKEN'))
      .mockResolvedValueOnce(sessionOk())
      .mockResolvedValueOnce(fail(401, 'INVALID_TOKEN'));

    await expect(api.startTryOn({ photoKey: 'k', productImageUrl: 'https://x.test/p.jpg', views: 'multi' })).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('errors', () => {
  test('carries the server code, the photo problem and the retry time', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(fail(429, 'RATE_LIMITED', {}, { 'Retry-After': '7' }));

    const error = await api.startTryOn({ photoKey: 'k', productImageUrl: 'https://x.test/p.jpg', views: 'multi' }).catch(e => e);

    expect(error).toBeInstanceOf(WidgetApiError);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAfterMs: 7000 });
  });

  test('a refused photo carries the problem found', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(fail(422, 'PHOTO_PROBLEM', { problem: 'NO_PERSON' }));

    const error = await api.uploadPhoto(new Blob(['x'], { type: 'image/jpeg' })).catch(e => e);

    expect(error).toMatchObject({ code: 'PHOTO_PROBLEM', problem: 'NO_PERSON' });
  });

  test('a lost connection becomes NETWORK, not a raw exception', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.startTryOn({ photoKey: 'k', productImageUrl: 'https://x.test/p.jpg', views: 'multi' })).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  test('an answer that is not JSON becomes a server error', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }));

    await expect(api.startTryOn({ photoKey: 'k', productImageUrl: 'https://x.test/p.jpg', views: 'multi' })).rejects.toMatchObject({
      code: 'SERVER_ERROR',
      status: 502,
    });
  });
});

describe('uploadPhoto', () => {
  test('sends the image bytes with their own content type and returns the key', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(ok({ photoKey: 'tryon/person/s/x/1.jpg' }));
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

    await expect(api.uploadPhoto(photo)).resolves.toEqual({ photoKey: 'tryon/person/s/x/1.jpg' });

    const call = fetchMock.mock.calls[1];
    expect(urlOf(call)).toBe('https://app.mirrae.test/api/storefront/photo');
    expect(initOf(call).method).toBe('POST');
    expect(initOf(call).headers['Content-Type']).toBe('image/png');
    expect(initOf(call).body).toBe(photo);
  });

  test('refuses a file that is not an image without calling the server', async () => {
    const { api, fetchMock } = setup();

    await expect(api.uploadPhoto(new Blob(['x'], { type: 'application/pdf' }))).rejects.toMatchObject({ code: 'INVALID_PHOTO' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('refuses a photo over 8 MB without calling the server', async () => {
    const { api, fetchMock } = setup();
    const big = new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: 'image/jpeg' });

    await expect(api.uploadPhoto(big)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('startTryOn', () => {
  test('posts the photo, the product image and the views, with consent recorded', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(ok({ jobId: JOB }, 202));

    await expect(api.startTryOn({ photoKey: 'pk', productImageUrl: 'https://cdn.shopify.com/p.jpg', views: 'multi' })).resolves.toEqual({ jobId: JOB });

    const call = fetchMock.mock.calls[1];
    expect(urlOf(call)).toBe('https://app.mirrae.test/api/storefront/tryon');
    expect(JSON.parse(String(initOf(call).body))).toEqual({
      photoKey: 'pk',
      productImageUrl: 'https://cdn.shopify.com/p.jpg',
      views: 'multi',
      consent: true,
    });
  });
});

describe('waitForResult', () => {
  const done = (extra: object = {}) => ok({ status: 'done', resultUrl: 'https://s3/front.png', viewCount: 3, extrasPending: false, ...extra });

  test('polls until every view is ready, reporting each update, waiting between polls', async () => {
    const { api, fetchMock, sleeps } = setup();
    fetchMock
      .mockResolvedValueOnce(sessionOk())
      .mockResolvedValueOnce(ok({ status: 'processing' }))
      .mockResolvedValueOnce(done({ extrasPending: true }))
      .mockResolvedValueOnce(done({ sideUrl: 'https://s3/side.png', backUrl: 'https://s3/back.png' }));
    const updates: string[] = [];

    const result = await api.waitForResult(JOB, { onUpdate: status => updates.push(`${status.status}${'extrasPending' in status && status.extrasPending ? '+pending' : ''}`) });

    expect(updates).toEqual(['processing', 'done+pending', 'done']);
    expect(result).toMatchObject({ status: 'done', sideUrl: 'https://s3/side.png', backUrl: 'https://s3/back.png' });
    expect(sleeps.length).toBeGreaterThanOrEqual(2);
    expect(urlOf(fetchMock.mock.calls[1])).toBe(`https://app.mirrae.test/api/storefront/status?jobId=${JOB}`);
  });

  test('stops waiting for the side and back views after a while and returns what it has', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockImplementation(async () => done({ extrasPending: true }));

    const result = await api.waitForResult(JOB, {});

    expect(result).toMatchObject({ status: 'done', extrasPending: true });
  });

  test('a failed job becomes JOB_FAILED', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(ok({ status: 'failed', error: 'Try-on failed.' }));

    await expect(api.waitForResult(JOB, {})).rejects.toMatchObject({ code: 'JOB_FAILED' });
  });

  test('gives up with TIMEOUT when the job never finishes', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(sessionOk()).mockImplementation(async () => ok({ status: 'processing' }));

    await expect(api.waitForResult(JOB, {})).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  test('rides out a short connection blip but not a long outage', async () => {
    const blip = setup();
    blip.fetchMock
      .mockResolvedValueOnce(sessionOk())
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(done());
    await expect(blip.api.waitForResult(JOB, {})).resolves.toMatchObject({ status: 'done' });

    const outage = setup();
    outage.fetchMock.mockResolvedValueOnce(sessionOk()).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(outage.api.waitForResult(JOB, {})).rejects.toMatchObject({ code: 'NETWORK' });
  });

  test('stops at once when aborted, without another request', async () => {
    const { api, fetchMock } = setup();
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockResolvedValueOnce(sessionOk());

    await expect(api.waitForResult(JOB, { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
    expect(fetchMock.mock.calls.filter(call => urlOf(call).includes('/status'))).toHaveLength(0);
  });
});
