import { shareImage, type ShareDeps } from './share';

const IMAGE_URL = 'https://bucket.example/result.jpg';

function makeDeps(overrides: Partial<ShareDeps> = {}): ShareDeps {
  return {
    fetch: jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }),
    navigator: undefined,
    download: jest.fn(),
    ...overrides,
  };
}

describe('shareImage', () => {
  test('uses the native share sheet when the browser can share image files', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ navigator: { canShare: () => true, share } });

    const outcome = await shareImage(IMAGE_URL, deps);

    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    expect(deps.download).not.toHaveBeenCalled();
  });

  test('downloads the image when the browser has no share sheet', async () => {
    const deps = makeDeps();

    const outcome = await shareImage(IMAGE_URL, deps);

    expect(outcome).toBe('downloaded');
    expect(deps.download).toHaveBeenCalledWith(expect.any(Blob), 'mirrae-try-on.jpg');
  });

  test('does not download after the shopper closes the share sheet', async () => {
    const abort = new DOMException('closed', 'AbortError');
    const deps = makeDeps({ navigator: { canShare: () => true, share: jest.fn().mockRejectedValue(abort) } });

    const outcome = await shareImage(IMAGE_URL, deps);

    expect(outcome).toBe('cancelled');
    expect(deps.download).not.toHaveBeenCalled();
  });

  test('downloads when sharing fails for another reason', async () => {
    const deps = makeDeps({ navigator: { canShare: () => true, share: jest.fn().mockRejectedValue(new Error('denied')) } });

    expect(await shareImage(IMAGE_URL, deps)).toBe('downloaded');
  });

  test('asks the shopper to save the picture by hand when it cannot be fetched as a file, and opens nothing', async () => {
    const deps = makeDeps({ fetch: jest.fn().mockRejectedValue(new TypeError('CORS')) });

    const outcome = await shareImage(IMAGE_URL, deps);

    expect(outcome).toBe('manual');
    expect(deps.download).not.toHaveBeenCalled();
  });

  test('does the same when the storage answers with an error', async () => {
    const deps = makeDeps({ fetch: jest.fn().mockResolvedValue({ ok: false }) });

    expect(await shareImage(IMAGE_URL, deps)).toBe('manual');
  });
});
