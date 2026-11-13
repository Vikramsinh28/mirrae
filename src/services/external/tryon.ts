import { z } from 'zod';

/**
 * Single swappable try-on provider. Nothing outside this file knows which
 * vendor is used: swap the provider by changing only this file.
 *
 * Uses fal's queue API (submit + poll), which fal recommends over the
 * synchronous endpoint for long-running requests.
 */

// Verified against https://fal.ai/models/fal-ai/fashn/tryon/v1.6/api on 2026-11-07; re-check on upgrade.
const FAL_MODEL_ID = 'fal-ai/fashn/tryon/v1.6';
const FAL_QUEUE_ORIGIN = 'https://queue.fal.run';
const SUBMIT_URL = `${FAL_QUEUE_ORIGIN}/${FAL_MODEL_ID}`;

// Jobs take ~20-40s. Worst case here (75s + one 15s request) + 30s result download + 20s upload
// stays well under the 3-minute stale-job threshold.
const DEFAULT_TIMEOUT_MS = 75_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const REQUEST_TIMEOUT_MS = 15_000;

export interface TryOnInput {
  personImageUrl: string;
  productImageUrl: string;
}

export interface TryOnOutput {
  resultUrl: string;
}

export interface TryOnOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export class TryOnProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TryOnProviderError';
  }
}

const submitSchema = z.object({
  request_id: z.string(),
  status_url: z.string().url(),
  response_url: z.string().url(),
  cancel_url: z.string().url().optional(),
});
const statusSchema = z.object({ status: z.enum(['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED']) });
const resultSchema = z.object({
  images: z.array(z.object({ url: z.string().url() })).min(1),
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// The API key is sent to URLs the provider returned; never to any other origin.
function assertFalUrl(url: string): string {
  if (!url.startsWith(`${FAL_QUEUE_ORIGIN}/`)) {
    throw new TryOnProviderError('Try-on provider returned an unexpected URL');
  }
  return url;
}

async function falRequest<T>(
  apiKey: string,
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new TryOnProviderError('Try-on provider timed out');
    }
    throw new TryOnProviderError('Try-on provider request failed');
  }

  if (!response.ok) {
    console.error('Try-on provider error', response.status);
    throw new TryOnProviderError(`Try-on provider returned ${response.status}`);
  }

  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new TryOnProviderError('Try-on provider returned an unexpected response');
  return parsed.data;
}

async function cancelQuietly(apiKey: string, cancelUrl: string | undefined) {
  if (!cancelUrl?.startsWith(`${FAL_QUEUE_ORIGIN}/`)) return;
  try {
    await fetch(cancelUrl, {
      method: 'PUT',
      headers: { Authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Best effort: the job is already being failed on our side
  }
}

export async function runTryOn(
  { personImageUrl, productImageUrl }: TryOnInput,
  { timeoutMs = DEFAULT_TIMEOUT_MS, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }: TryOnOptions = {}
): Promise<TryOnOutput> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error('FAL_KEY is required');

  const deadline = Date.now() + timeoutMs;

  const submitted = await falRequest(apiKey, SUBMIT_URL, submitSchema, {
    method: 'POST',
    body: JSON.stringify({
      model_image: personImageUrl,
      garment_image: productImageUrl,
      category: 'auto',
    }),
  });
  const statusUrl = assertFalUrl(submitted.status_url);
  const responseUrl = assertFalUrl(submitted.response_url);

  for (;;) {
    const { status } = await falRequest(apiKey, statusUrl, statusSchema);
    if (status === 'COMPLETED') break;

    if (Date.now() + pollIntervalMs >= deadline) {
      await cancelQuietly(apiKey, submitted.cancel_url);
      throw new TryOnProviderError('Try-on provider timed out');
    }
    await sleep(pollIntervalMs);
  }

  const result = await falRequest(apiKey, responseUrl, resultSchema);
  return { resultUrl: result.images[0].url };
}
