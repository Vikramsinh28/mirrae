import { requestOrigin, storefrontFailure, storefrontJson, STOREFRONT_TOKEN_HEADER } from '@/lib/storefront/http';
import { StorefrontService } from '@/services/internal/storefront';
import { storefrontStatusQuerySchema } from '@/validations/storefront';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get(STOREFRONT_TOKEN_HEADER);
    if (!token) return storefrontFailure(request, { reason: 'MISSING_TOKEN' });

    const parsed = storefrontStatusQuerySchema.safeParse({ jobId: request.nextUrl.searchParams.get('jobId') });
    if (!parsed.success) return storefrontFailure(request, { reason: 'BAD_REQUEST' });

    const result = await StorefrontService.getStatus({
      token,
      origin: requestOrigin(request),
      jobId: parsed.data.jobId,
    });
    if (!result.ok) return storefrontFailure(request, result);

    return storefrontJson(request, result.status);
  } catch (error) {
    console.error('Error fetching storefront status:', error);
    return storefrontFailure(request, { reason: 'SERVER_ERROR' });
  }
}
