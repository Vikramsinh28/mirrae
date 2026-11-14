import { generateExtraView } from './tryon-views';
import { TryOnProviderError } from './vertex-client';

const getAccessToken = jest.fn();
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({ getAccessToken })),
}));

const input = {
  frontImage: { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' },
  garmentBase64: 'R0FSTUVOVA==',
  garmentContentType: 'image/jpeg',
};
const IMAGE_B64 = Buffer.from([5, 6, 7]).toString('base64');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const withImage = () =>
  json({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { data: IMAGE_B64, mimeType: 'image/png' } }] } }] });

describe('generateExtraView (Gemini image editing)', () => {
  const originalProject = process.env.GOOGLE_CLOUD_PROJECT;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    getAccessToken.mockResolvedValue('test-token');
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    getAccessToken.mockReset();
    if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
    else process.env.GOOGLE_CLOUD_PROJECT = originalProject;
  });

  test('sends the front result and the garment with a side-view prompt and returns the image bytes', async () => {
    fetchSpy.mockResolvedValue(withImage());

    const result = await generateExtraView({ ...input, view: 'side' });

    expect(result.contentType).toBe('image/png');
    expect(Array.from(result.bytes)).toEqual([5, 6, 7]);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      'https://aiplatform.googleapis.com/v1/projects/test-project/locations/global' +
        '/publishers/google/models/gemini-2.5-flash-image:generateContent'
    );
    expect(init.headers.Authorization).toBe('Bearer test-token');
    const [prompt, front, garment] = JSON.parse(init.body).contents[0].parts;
    expect(prompt.text).toMatch(/left side/);
    expect(front.inlineData).toEqual({ mimeType: 'image/png', data: Buffer.from([1, 2, 3]).toString('base64') });
    expect(garment.inlineData).toEqual({ mimeType: 'image/jpeg', data: input.garmentBase64 });
  });

  test('uses a different prompt for the back view', async () => {
    fetchSpy.mockResolvedValue(withImage());

    await generateExtraView({ ...input, view: 'back' });

    const prompt = JSON.parse(fetchSpy.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(prompt).toMatch(/directly behind/);
  });

  test('throws TryOnProviderError when the model returns no image', async () => {
    fetchSpy.mockResolvedValue(json({ candidates: [{ content: { parts: [{ text: 'I cannot do that' }] } }] }));

    await expect(generateExtraView({ ...input, view: 'side' })).rejects.toBeInstanceOf(TryOnProviderError);
  });

  test('throws TryOnProviderError on a 429 rate limit without leaking the body', async () => {
    fetchSpy.mockResolvedValue(json({ error: { message: 'quota details' } }, 429));

    const error = await generateExtraView({ ...input, view: 'side' }, { retryDelaysMs: [] }).catch(e => e);

    expect(error).toBeInstanceOf(TryOnProviderError);
    expect(error.message).toBe('Try-on provider returned 429');
    expect(error.message).not.toContain('quota');
  });

  describe('retries when the provider says it is rate limited (new projects have a low Gemini quota)', () => {
    const rateLimited = () => json({ error: { message: 'quota details' } }, 429);

    test('succeeds when a retry gets through, waiting between attempts', async () => {
      const sleeps: number[] = [];
      fetchSpy.mockResolvedValueOnce(rateLimited()).mockResolvedValueOnce(rateLimited()).mockResolvedValueOnce(withImage());

      const result = await generateExtraView(
        { ...input, view: 'back' },
        { retryDelaysMs: [3000, 6000], sleep: async ms => void sleeps.push(ms) }
      );

      expect(Array.from(result.bytes)).toEqual([5, 6, 7]);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(sleeps).toEqual([3000, 6000]);
    });

    test('gives up after the last retry and reports the rate limit', async () => {
      fetchSpy.mockImplementation(async () => rateLimited());

      await expect(
        generateExtraView({ ...input, view: 'back' }, { retryDelaysMs: [1, 1], sleep: async () => undefined })
      ).rejects.toMatchObject({ status: 429 });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    test.each([403, 500, 503])('does not retry a %i, only rate limits', async status => {
      fetchSpy.mockImplementation(async () => json({ error: {} }, status));

      await expect(
        generateExtraView({ ...input, view: 'back' }, { retryDelaysMs: [1, 1], sleep: async () => undefined })
      ).rejects.toMatchObject({ status });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test('does not retry a response that simply has no image', async () => {
      fetchSpy.mockImplementation(async () => json({ candidates: [{ content: { parts: [{ text: 'no' }] } }] }));

      await expect(
        generateExtraView({ ...input, view: 'back' }, { retryDelaysMs: [1, 1], sleep: async () => undefined })
      ).rejects.toBeInstanceOf(TryOnProviderError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  test('maps a timeout to a timeout error', async () => {
    fetchSpy.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    await expect(generateExtraView({ ...input, view: 'back' })).rejects.toThrow(/timed out/i);
  });
});
