import sharp from 'sharp';

import { prepareTryOnImage, TryOnImageError } from './tryon-image';

const GREY = { r: 128, g: 128, b: 128 };

/** Deterministic noisy RGB pixels so "content" rows are never near-uniform. */
function noisyPixels(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 3);
  for (let i = 0; i < data.length; i++) data[i] = (i * 2654435761) >>> 24;
  return data;
}

const noisyImage = (width: number, height: number) =>
  sharp(noisyPixels(width, height), { raw: { width, height, channels: 3 } });

/** A photo with solid grey letterbox bars above and below, like a phone screenshot. */
async function letterboxed(width: number, contentHeight: number, bar: number): Promise<Buffer> {
  const content = await noisyImage(width, contentHeight).png().toBuffer();
  return sharp({ create: { width, height: contentHeight + bar * 2, channels: 3, background: GREY } })
    .composite([{ input: content, top: bar, left: 0 }])
    .png()
    .toBuffer();
}

const decode = async (prepared: { base64: string }) => {
  const image = sharp(Buffer.from(prepared.base64, 'base64'));
  return { meta: await image.metadata() };
};

describe('prepareTryOnImage', () => {
  test('converts WebP input to a JPEG the provider accepts', async () => {
    const webp = await noisyImage(120, 160).webp().toBuffer();

    const prepared = await prepareTryOnImage(webp);

    expect(prepared.contentType).toBe('image/jpeg');
    expect((await decode(prepared)).meta.format).toBe('jpeg');
  });

  test('crops solid letterbox bars above and below the photo', async () => {
    const input = await letterboxed(200, 300, 40);

    const { meta } = await decode(await prepareTryOnImage(input));

    expect(meta.width).toBe(200);
    expect(meta.height).toBeGreaterThanOrEqual(296);
    expect(meta.height).toBeLessThanOrEqual(304);
  });

  test('leaves a photo without bars at its original size', async () => {
    const input = await noisyImage(200, 300).png().toBuffer();

    const { meta } = await decode(await prepareTryOnImage(input));

    expect([meta.width, meta.height]).toEqual([200, 300]);
  });

  test('never crops more than a quarter of the image from any side', async () => {
    const mostlyBar = await sharp({ create: { width: 100, height: 400, channels: 3, background: GREY } })
      .png()
      .toBuffer();

    const { meta } = await decode(await prepareTryOnImage(mostlyBar));

    expect(meta.height).toBeGreaterThanOrEqual(200);
  });

  test('downscales very large images to at most 2048px on the long side', async () => {
    const big = await noisyImage(3000, 1500).png().toBuffer();

    const { meta } = await decode(await prepareTryOnImage(big));

    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(2048);
  });

  test('flattens transparency onto white so the output has no alpha channel', async () => {
    const transparent = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const { meta } = await decode(await prepareTryOnImage(transparent));

    expect(meta.hasAlpha).toBe(false);
  });

  test('applies EXIF orientation so phone photos are not sideways', async () => {
    const rotatedByExif = await noisyImage(200, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer();

    const { meta } = await decode(await prepareTryOnImage(rotatedByExif));

    expect([meta.width, meta.height]).toEqual([100, 200]);
  });

  test('throws TryOnImageError for bytes that are not an image', async () => {
    await expect(prepareTryOnImage(Buffer.from('definitely not an image'))).rejects.toBeInstanceOf(
      TryOnImageError
    );
  });
});
