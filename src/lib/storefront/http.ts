import { NextRequest, NextResponse } from 'next/server';

/** HTTP plumbing shared by the anonymous storefront routes. */

export const STOREFRONT_TOKEN_HEADER = 'x-storefront-token';
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const FAILURES: Record<string, { status: number; message: string }> = {
  UNKNOWN_SHOP: { status: 404, message: 'Unknown shop key' },
  SHOP_INACTIVE: { status: 403, message: 'Try-on is not active for this shop' },
  ORIGIN_NOT_ALLOWED: { status: 403, message: 'This website is not allowed to use this shop key' },
  INVALID_TOKEN: { status: 401, message: 'Your session expired. Please reload the page.' },
  RATE_LIMITED: { status: 429, message: 'Too many requests. Please wait a moment and try again.' },
  // The shopper never learns about the merchant's billing: both of these read as "unavailable".
  DAILY_CAP_REACHED: { status: 503, message: 'Try-on is temporarily unavailable. Please try again later.' },
  INSUFFICIENT_CREDITS: { status: 503, message: 'Try-on is temporarily unavailable. Please try again later.' },
  INVALID_PRODUCT_IMAGE: { status: 400, message: 'This product image cannot be used for a try-on.' },
  INVALID_PHOTO: { status: 400, message: 'We could not read that photo. Please upload a JPEG, PNG or WebP image.' },
  CONSENT_REQUIRED: { status: 400, message: 'Consent to process the photo is required' },
  PHOTO_PROBLEM: { status: 422, message: 'This photo cannot be used for a try-on.' },
  NOT_FOUND: { status: 404, message: 'Try-on not found' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'Send the photo as an image' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'That photo is too large' },
  BAD_REQUEST: { status: 400, message: 'Invalid request' },
  SERVER_ERROR: { status: 500, message: 'Something went wrong. Please try again.' },
  MISSING_TOKEN: { status: 401, message: 'Your session expired. Please reload the page.' },
};

/**
 * The page origin that made the request. Browsers always send Origin on cross-origin requests (every real
 * merchant site) but omit it on same-origin GETs (our own demo page). Sec-Fetch-Site cannot be forged by page
 * scripts, so "same-origin" with no Origin means the request came from our own site. Anything else with no
 * Origin is unknown and gets refused by the service.
 */
export function requestOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  return request.headers.get('sec-fetch-site') === 'same-origin' ? request.nextUrl.origin : '';
}

/** The first address in X-Forwarded-For (set by the reverse proxy), else X-Real-IP, else "unknown". */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Every response is readable by the page that made the request. This is safe because nothing sensitive is
 * returned and the service has already enforced the token and the shop's allowed origins; the CORS header
 * only lets the widget read the answer (including errors it must act on).
 */
function withCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Expose-Headers', 'Retry-After');
  }
  response.headers.set('Vary', 'Origin');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function storefrontJson(request: NextRequest, data: unknown, status = 200): NextResponse {
  return withCors(request, NextResponse.json({ success: true, data }, { status }));
}

export function storefrontFailure(
  request: NextRequest,
  failure: { reason: string; retryAfterMs?: number; problem?: string; message?: string }
): NextResponse {
  const known = FAILURES[failure.reason] ?? FAILURES.BAD_REQUEST;
  const response = NextResponse.json(
    {
      success: false,
      code: failure.reason,
      message: failure.message ?? known.message,
      ...(failure.problem ? { problem: failure.problem } : {}),
    },
    { status: known.status }
  );
  if (failure.retryAfterMs) response.headers.set('Retry-After', String(Math.ceil(failure.retryAfterMs / 1000)));
  return withCors(request, response);
}

/** Reads a request body into memory, refusing it as soon as it passes the limit (the length header can lie). */
export async function readBodyCapped(request: NextRequest, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
