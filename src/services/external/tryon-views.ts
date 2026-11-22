import { z } from 'zod';

import type { TryOnImage } from './tryon';
import { TryOnProviderError, vertexModelUrl, vertexPost } from './vertex-client';

/**
 * Extra camera angles (side, back) for a finished try-on, made with Gemini image editing on Vertex AI.
 * Gemini is NOT used for the try-on itself: in testing it redrew the photo or ignored the garment.
 * It is good at re-posing an existing result, but the back of a garment is invented from the front photo.
 *
 * Verified by experiment on 2026-11-14 with `gemini-2.5-flash-image` in the `global` location.
 */

const VIEWS_MODEL_ID = process.env.VERTEX_VIEWS_MODEL || 'gemini-2.5-flash-image';
const VIEWS_LOCATION = 'global';
// ~45s alone, up to ~90s under rate-limit pressure.
const DEFAULT_TIMEOUT_MS = 100_000;

export type ExtraView = 'side' | 'back';

const SCENE =
  'Image 1 is a photo of a person wearing an outfit. Image 2 is a product photo of the garment they are wearing. ' +
  'Create a realistic photo of the SAME person (same face, identity, skin tone, hair, body shape) wearing the SAME garment ' +
  '(exact color, fabric, pattern, fit and details from images 1 and 2), in the SAME place with the same lighting and background style, ';

const VIEW_PROMPTS: Record<ExtraView, string> = {
  side:
    SCENE +
    'but photographed from their left side, turned about 70 degrees away from the camera, full body visible. ' +
    'No text, no watermark.',
  back:
    SCENE +
    'but photographed from directly behind, back to the camera, full body visible. ' +
    'If the back of the garment is not visible in the inputs, invent a plain, plausible back consistent with the front design. ' +
    'No text, no watermark.',
};

const generateSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ inlineData: z.object({ data: z.string(), mimeType: z.string() }).optional() })),
        }),
      })
    )
    .min(1),
});

export interface ExtraViewInput {
  view: ExtraView;
  /** The finished front try-on result. */
  frontImage: TryOnImage;
  /** The prepared garment photo, base64 JPEG/PNG without a data: prefix. */
  garmentBase64: string;
  garmentContentType: string;
}

const RATE_LIMITED_STATUS = 429;
// A new project's Gemini quota is low and extra views run in parallel, so a 429 is common: wait and retry.
const DEFAULT_RETRY_DELAYS_MS = [4_000, 8_000];
const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** One request to the model, reported after it finishes so slow or rate-limited views can be diagnosed. */
export interface ExtraViewAttempt {
  /** 1 for the first request, 2 for the first retry, and so on. */
  attempt: number;
  outcome: 'ok' | 'rate_limited' | 'error';
  /** HTTP status of the provider answer, when there was one. */
  status?: number;
  durationMs: number;
}

export interface ExtraViewOptions {
  timeoutMs?: number;
  /** Waits before each retry after a 429; empty means never retry. */
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Called after every attempt. An observer that throws never affects the view. */
  onAttempt?: (attempt: ExtraViewAttempt) => void;
}

async function requestExtraView(
  { view, frontImage, garmentBase64, garmentContentType }: ExtraViewInput,
  timeoutMs: number
): Promise<TryOnImage> {
  const body = await vertexPost(
    vertexModelUrl(VIEWS_MODEL_ID, 'generateContent', VIEWS_LOCATION),
    {
      contents: [
        {
          role: 'user',
          parts: [
            { text: VIEW_PROMPTS[view] },
            { inlineData: { mimeType: frontImage.contentType, data: Buffer.from(frontImage.bytes).toString('base64') } },
            { inlineData: { mimeType: garmentContentType, data: garmentBase64 } },
          ],
        },
      ],
      generationConfig: { responseModalities: ['IMAGE'] },
    },
    timeoutMs
  );

  const parsed = generateSchema.safeParse(body);
  const image = parsed.success
    ? parsed.data.candidates[0].content.parts.find(part => part.inlineData?.data)?.inlineData
    : undefined;
  if (!image) throw new TryOnProviderError('Try-on provider returned no image for this view');

  return { bytes: new Uint8Array(Buffer.from(image.data, 'base64')), contentType: image.mimeType };
}

function report(onAttempt: ExtraViewOptions['onAttempt'], attempt: ExtraViewAttempt): void {
  try {
    onAttempt?.(attempt);
  } catch {
    // Diagnostics must never break a view.
  }
}

export async function generateExtraView(
  input: ExtraViewInput,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    sleep = defaultSleep,
    onAttempt,
  }: ExtraViewOptions = {}
): Promise<TryOnImage> {
  for (let attempt = 1; ; attempt++) {
    const startedAt = Date.now();
    try {
      const image = await requestExtraView(input, timeoutMs);
      report(onAttempt, { attempt, outcome: 'ok', durationMs: Date.now() - startedAt });
      return image;
    } catch (error) {
      const status = error instanceof TryOnProviderError ? error.status : undefined;
      const rateLimited = status === RATE_LIMITED_STATUS;
      report(onAttempt, {
        attempt,
        outcome: rateLimited ? 'rate_limited' : 'error',
        ...(status === undefined ? {} : { status }),
        durationMs: Date.now() - startedAt,
      });
      const delay = retryDelaysMs.at(attempt - 1);
      if (!rateLimited || delay === undefined) throw error;
      await sleep(delay);
    }
  }
}
