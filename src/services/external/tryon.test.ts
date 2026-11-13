import { runTryOn, TryOnProviderError } from './tryon';

const input = {
  personImageUrl: 'https://s3.example/person.jpg',
  productImageUrl: 'https://s3.example/product.jpg',
};
const fast = { pollIntervalMs: 1, timeoutMs: 50 };

const Q = 'https://queue.fal.run/fal-ai/fashn/tryon/v1.6/requests/req-1';
const submitBody = {
  request_id: 'req-1',
  status_url: `${Q}/status`,
  response_url: Q,
  cancel_url: `${Q}/cancel`,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('runTryOn', () => {
  const originalKey = process.env.FAL_KEY;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.FAL_KEY = 'test-key';
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env.FAL_KEY = originalKey;
  });

  test('submits, polls until completed and returns the result url', async () => {
    fetchSpy
      .mockResolvedValueOnce(json(submitBody))
      .mockResolvedValueOnce(json({ status: 'IN_QUEUE' }))
      .mockResolvedValueOnce(json({ status: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(json({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(json({ images: [{ url: 'https://cdn.fashn.ai/out.png' }] }));

    const result = await runTryOn(input, fast);

    expect(result).toEqual({ resultUrl: 'https://cdn.fashn.ai/out.png' });
    const [submitUrl, init] = fetchSpy.mock.calls[0];
    expect(submitUrl).toBe('https://queue.fal.run/fal-ai/fashn/tryon/v1.6');
    expect(init.headers.Authorization).toBe('Key test-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model_image: input.personImageUrl,
      garment_image: input.productImageUrl,
    });
  });

  test('throws when FAL_KEY is missing', async () => {
    delete process.env.FAL_KEY;
    await expect(runTryOn(input, fast)).rejects.toThrow('FAL_KEY is required');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('throws TryOnProviderError on a non-2xx submit without leaking the body', async () => {
    fetchSpy.mockResolvedValue(json({ detail: 'secret internals' }, 500));

    const error = await runTryOn(input, fast).catch(e => e);

    expect(error).toBeInstanceOf(TryOnProviderError);
    expect(error.message).not.toContain('secret internals');
  });

  test('refuses to send the key to a non-fal status url', async () => {
    fetchSpy.mockResolvedValueOnce(json({ ...submitBody, status_url: 'https://evil.example/s' }));

    await expect(runTryOn(input, fast)).rejects.toThrow(/unexpected URL/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('times out, cancels the request and throws', async () => {
    fetchSpy.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(submitBody) : json({ status: 'IN_PROGRESS' })
    );

    await expect(runTryOn(input, fast)).rejects.toThrow(/timed out/i);
    const cancelCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(cancelCall?.[0]).toBe(`${Q}/cancel`);
  });

  test('throws when the result has no image', async () => {
    fetchSpy
      .mockResolvedValueOnce(json(submitBody))
      .mockResolvedValueOnce(json({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(json({ images: [] }));

    await expect(runTryOn(input, fast)).rejects.toBeInstanceOf(TryOnProviderError);
  });

  test('maps a network abort to a timeout error', async () => {
    fetchSpy.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    await expect(runTryOn(input, fast)).rejects.toThrow(/timed out/i);
  });
});
