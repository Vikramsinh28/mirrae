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

export async function generateExtraView(
  { view, frontImage, garmentBase64, garmentContentType }: ExtraViewInput,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {}
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
