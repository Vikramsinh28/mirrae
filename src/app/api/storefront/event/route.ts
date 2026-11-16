import { requestOrigin, storefrontFailure, storefrontJson, STOREFRONT_TOKEN_HEADER } from '@/lib/storefront/http';
import { StorefrontService } from '@/services/internal/storefront';
import { storefrontEventSchema } from '@/validations/storefront';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Records what a shopper did in the widget (opened, saw a result, added to cart, shared) for the merchant's numbers. */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get(STOREFRONT_TOKEN_HEADER);
    if (!token) return storefrontFailure(request, { reason: 'MISSING_TOKEN' });

    const parsed = storefrontEventSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return storefrontFailure(request, { reason: 'BAD_REQUEST' });

    const result = await StorefrontService.recordEvent({ token, origin: requestOrigin(request), type: parsed.data.type });
    if (!result.ok) return storefrontFailure(request, result);

    return storefrontJson(request, { recorded: true }, 202);
  } catch (error) {
    console.error('Error recording storefront event:', error);
    return storefrontFailure(request, { reason: 'SERVER_ERROR' });
  }
}
