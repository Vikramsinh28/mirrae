import { clientIp, storefrontFailure, storefrontJson, STOREFRONT_TOKEN_HEADER } from '@/lib/storefront/http';
import { StorefrontService } from '@/services/internal/storefront';
import { TryOnService } from '@/services/internal/tryon';
import { storefrontTryOnSchema } from '@/validations/storefront';
import { NextRequest, after } from 'next/server';

export const dynamic = 'force-dynamic';

/** Starts a try-on for a shopper session; the shop owner's credits pay for it. */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get(STOREFRONT_TOKEN_HEADER);
    if (!token) return storefrontFailure(request, { reason: 'MISSING_TOKEN' });

    const parsed = storefrontTryOnSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const consentMissing = parsed.error.issues.some(issue => issue.path[0] === 'consent');
      return storefrontFailure(request, { reason: consentMissing ? 'CONSENT_REQUIRED' : 'BAD_REQUEST' });
    }

    const result = await StorefrontService.startTryOn({
      token,
      origin: request.headers.get('origin') ?? '',
      ip: clientIp(request),
      ...parsed.data,
    });
    if (!result.ok) return storefrontFailure(request, result);

    // Runs after the response is sent; processJob never throws and fails the job on any error
    after(() => TryOnService.processJob(result.jobId));

    return storefrontJson(request, { jobId: result.jobId }, 202);
  } catch (error) {
    console.error('Error starting storefront try-on:', error);
    return storefrontFailure(request, { reason: 'SERVER_ERROR' });
  }
}
