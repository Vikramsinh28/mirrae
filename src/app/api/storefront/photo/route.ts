import {
  clientIp,
  requestOrigin,
  MAX_PHOTO_BYTES,
  readBodyCapped,
  storefrontFailure,
  storefrontJson,
  STOREFRONT_TOKEN_HEADER,
} from '@/lib/storefront/http';
import { StorefrontService } from '@/services/internal/storefront';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Receives the shopper's photo as the raw request body, cleans it, checks it and stores it. */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get(STOREFRONT_TOKEN_HEADER);
    if (!token) return storefrontFailure(request, { reason: 'MISSING_TOKEN' });

    if (!request.headers.get('content-type')?.startsWith('image/')) {
      return storefrontFailure(request, { reason: 'UNSUPPORTED_MEDIA_TYPE' });
    }

    const bytes = await readBodyCapped(request, MAX_PHOTO_BYTES);
    if (!bytes) return storefrontFailure(request, { reason: 'PAYLOAD_TOO_LARGE' });

    const result = await StorefrontService.uploadPhoto({
      token,
      origin: requestOrigin(request),
      ip: clientIp(request),
      bytes,
    });
    if (!result.ok) return storefrontFailure(request, result);

    return storefrontJson(request, { photoKey: result.photoKey });
  } catch (error) {
    console.error('Error uploading storefront photo:', error);
    return storefrontFailure(request, { reason: 'SERVER_ERROR' });
  }
}
