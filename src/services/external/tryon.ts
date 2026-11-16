import { z } from 'zod';

import { TryOnProviderError, vertexModelUrl, vertexPost } from './vertex-client';

export { TryOnProviderError };

/**
 * Single swappable try-on provider. Nothing outside src/services/external/ knows which
 * vendor is used: swap the provider by changing only these files (this one, tryon-views.ts, vertex-client.ts).
 *
 * Uses Google Vertex AI's `virtual-try-on-001` model through the synchronous `predict` method.
 * Vertex takes the images as base64 (not URLs) and returns the result as base64, so this file takes
 * already-prepared base64 images (see internal/tryon-image.ts) and hands the result back as bytes.
 *
 * Verified against https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/generate-virtual-try-on-images
 * on 2026-11-14; re-check on upgrade (third-party sources mention a 2027-03-15 deprecation of this model).
 */

const VERTEX_MODEL_ID = 'virtual-try-on-001';

// Jobs take roughly 10-40s. 75s stays well under the 3-minute stale-job threshold.
const DEFAULT_TIMEOUT_MS = 75_000;

/** Both images must be JPEG or PNG (<= 10 MB each), base64-encoded without a data: prefix. */
export interface TryOnInput {
  personImageBase64: string;
  productImageBase64: string;
}

export interface TryOnImage {
  bytes: Uint8Array;
  contentType: string;
}

export interface TryOnOutput {
  image: TryOnImage;
}

export interface TryOnOptions {
  timeoutMs?: number;
}

const predictSchema = z.object({
  predictions: z
    .array(z.object({ bytesBase64Encoded: z.string().min(1), mimeType: z.string().optional() }))
    .min(1),
});

export async function runTryOn(
  { personImageBase64, productImageBase64 }: TryOnInput,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: TryOnOptions = {}
): Promise<TryOnOutput> {
  const body = await vertexPost(
    vertexModelUrl(VERTEX_MODEL_ID, 'predict'),
    {
      instances: [
        {
          personImage: { image: { bytesBase64Encoded: personImageBase64 } },
          productImages: [{ image: { bytesBase64Encoded: productImageBase64 } }],
        },
      ],
      parameters: { sampleCount: 1 },
    },
    timeoutMs
  );

  // A safety-filtered result comes back without an image and lands here.
  const parsed = predictSchema.safeParse(body);
  if (!parsed.success) throw new TryOnProviderError('Try-on provider returned an unexpected response');

  const [prediction] = parsed.data.predictions;
  return {
    image: {
      bytes: new Uint8Array(Buffer.from(prediction.bytesBase64Encoded, 'base64')),
      contentType: prediction.mimeType ?? 'image/png',
    },
  };
}
