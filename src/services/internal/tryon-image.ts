import sharp from 'sharp';

/**
 * Normalises any shopper/product photo into something the try-on provider reliably accepts:
 * upright (EXIF applied), flattened onto white, free of screenshot-style letterbox bars,
 * at most 2048px on the long side, and encoded as JPEG (providers reject WebP/AVIF).
 */

const MAX_DIMENSION_PX = 2048;
const MIN_DIMENSION_PX = 64;
// Decoding is bounded: 48 MP phone photos are fine, decompression bombs are not.
const MAX_INPUT_PIXELS = 64_000_000;
const JPEG_QUALITY = 92;
// A row/column whose pixel values barely vary is treated as a solid bar, not photo content.
const UNIFORM_LINE_STDEV = 2.5;
const MAX_CROP_FRACTION = 0.25;
const SAMPLE_STRIDE = 4;
const CHANNELS = 3;

export class TryOnImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TryOnImageError';
  }
}

export interface PreparedTryOnImage {
  base64: string;
  contentType: 'image/jpeg';
}

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
}

const luma = (data: Buffer, offset: number) =>
  0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];

function stdev(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function lineIsUniform({ data, width, height }: RawImage, index: number, axis: 'row' | 'column'): boolean {
  const length = axis === 'row' ? width : height;
  const samples: number[] = [];
  for (let step = 0; step < length; step += SAMPLE_STRIDE) {
    const x = axis === 'row' ? step : index;
    const y = axis === 'row' ? index : step;
    samples.push(luma(data, (y * width + x) * CHANNELS));
  }
  return stdev(samples) < UNIFORM_LINE_STDEV;
}

/** Counts solid lines from one edge inwards, never more than MAX_CROP_FRACTION of the image. */
function countBarLines(image: RawImage, axis: 'row' | 'column', fromEnd: boolean): number {
  const total = axis === 'row' ? image.height : image.width;
  const limit = Math.floor(total * MAX_CROP_FRACTION);
  let count = 0;
  while (count < limit) {
    const index = fromEnd ? total - 1 - count : count;
    if (!lineIsUniform(image, index, axis)) break;
    count++;
  }
  return count;
}

function findContentBox(image: RawImage) {
  const top = countBarLines(image, 'row', false);
  const bottom = countBarLines(image, 'row', true);
  const left = countBarLines(image, 'column', false);
  const right = countBarLines(image, 'column', true);
  return {
    left,
    top,
    width: image.width - left - right,
    height: image.height - top - bottom,
  };
}

async function decodeUpright(bytes: Uint8Array): Promise<RawImage> {
  const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: MAX_DIMENSION_PX, height: MAX_DIMENSION_PX, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function prepareTryOnImage(bytes: Uint8Array): Promise<PreparedTryOnImage> {
  let image: RawImage;
  try {
    image = await decodeUpright(bytes);
  } catch {
    throw new TryOnImageError('Could not read the image');
  }

  if (Math.min(image.width, image.height) < MIN_DIMENSION_PX) {
    throw new TryOnImageError('Image is too small');
  }

  const box = findContentBox(image);
  const jpeg = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: CHANNELS } })
    .extract(box)
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { base64: jpeg.toString('base64'), contentType: 'image/jpeg' };
}
