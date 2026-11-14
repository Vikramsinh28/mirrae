import { clientIp, storefrontFailure, storefrontJson } from '@/lib/storefront/http';
import { StorefrontService } from '@/services/internal/storefront';
import { storefrontSessionSchema } from '@/validations/storefront';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Opens an anonymous shopper session for a shop. Public: protected by the shop's allowed origins and rate limits. */
export async function POST(request: NextRequest) {
  try {
    const parsed = storefrontSessionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return storefrontFailure(request, { reason: 'BAD_REQUEST' });

    const result = await StorefrontService.openSession({
      publicKey: parsed.data.publicKey,
      origin: request.headers.get('origin') ?? '',
      ip: clientIp(request),
    });
    if (!result.ok) return storefrontFailure(request, result);

    return storefrontJson(request, { token: result.token, shopName: result.shopName });
  } catch (error) {
    console.error('Error opening storefront session:', error);
    return storefrontFailure(request, { reason: 'SERVER_ERROR' });
  }
}
