import { runTryOn, TryOnProviderError } from './tryon';

const getAccessToken = jest.fn();
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({ getAccessToken })),
}));

const input = { personImageBase64: 'UEVSU09O', productImageBase64: 'R0FSTUVOVA==' };
const RESULT_B64 = Buffer.from([9, 8, 7]).toString('base64');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const prediction = () => json({ predictions: [{ bytesBase64Encoded: RESULT_B64, mimeType: 'image/png' }] });

const ENV_KEYS = ['GOOGLE_CLOUD_PROJECT', 'VERTEX_LOCATION'] as const;

describe('runTryOn (Vertex AI virtual-try-on-001)', () => {
  const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    delete process.env.VERTEX_LOCATION;
    getAccessToken.mockResolvedValue('test-token');
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    getAccessToken.mockReset();
    ENV_KEYS.forEach(key => {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    });
  });

  test('posts both images to the predict endpoint and returns the result bytes', async () => {
    fetchSpy.mockResolvedValue(prediction());

    const result = await runTryOn(input);

    expect(result.image.contentType).toBe('image/png');
    expect(Array.from(result.image.bytes)).toEqual([9, 8, 7]);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      'https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1' +
        '/publishers/google/models/virtual-try-on-001:predict'
    );
    expect(init.headers.Authorization).toBe('Bearer test-token');
    const body = JSON.parse(init.body);
    expect(body.instances[0].personImage.image.bytesBase64Encoded).toBe(input.personImageBase64);
    expect(body.instances[0].productImages[0].image.bytesBase64Encoded).toBe(input.productImageBase64);
    expect(body.parameters).toEqual({ sampleCount: 1 });
  });

  test('uses VERTEX_LOCATION and the global host when asked', async () => {
    process.env.VERTEX_LOCATION = 'global';
    fetchSpy.mockResolvedValue(prediction());

    await runTryOn(input);

    expect(fetchSpy.mock.calls[0][0]).toContain(
      'https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/'
    );
  });

  test('throws when GOOGLE_CLOUD_PROJECT is missing, before any network call', async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    await expect(runTryOn(input)).rejects.toThrow('GOOGLE_CLOUD_PROJECT is required');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('throws TryOnProviderError when no access token can be obtained', async () => {
    getAccessToken.mockRejectedValue(new Error('no credentials'));
    await expect(runTryOn(input)).rejects.toThrow(/authentication failed/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('throws TryOnProviderError on a non-2xx response without leaking the body', async () => {
    fetchSpy.mockResolvedValue(json({ error: { message: 'secret internals' } }, 403));

    const error = await runTryOn(input).catch(e => e);

    expect(error).toBeInstanceOf(TryOnProviderError);
    expect(error.message).toBe('Try-on provider returned 403');
    expect(error.message).not.toContain('secret internals');
  });

  test('throws when the response has no usable prediction (for example a safety-filtered result)', async () => {
    fetchSpy.mockResolvedValueOnce(json({ predictions: [{ raiFilteredReason: 'blocked' }] }));
    await expect(runTryOn(input)).rejects.toBeInstanceOf(TryOnProviderError);

    fetchSpy.mockResolvedValueOnce(json({}));
    await expect(runTryOn(input)).rejects.toBeInstanceOf(TryOnProviderError);
  });

  test('maps a network timeout to a timeout error', async () => {
    fetchSpy.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    await expect(runTryOn(input)).rejects.toThrow(/timed out/i);
  });

  test('maps any other network failure to a generic request error', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNRESET'));
    await expect(runTryOn(input)).rejects.toThrow('Try-on provider request failed');
  });
});
