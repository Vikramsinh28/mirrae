import { NextResponse } from 'next/server';

import { parseShopId, requireMerchant, tooManyChecksResponse } from '@/app/api/shops/shop-route-helpers';
import { verificationLimiter } from '@/lib/shops/verification-limits';
import { LOOKUP_FAILED_MESSAGE, NO_RECORD_MESSAGE } from '@/lib/shops/verification-messages';
import { internalServerErrorResponse, notFoundResponse, successResponse } from '@/lib/utils/response/response';
import { ShopVerificationService } from '@/services/internal/shop-verification';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Checks the DNS record and, if it is there, marks the shop as verified. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const shopId = parseShopId((await params).id);
    if (!shopId) return notFoundResponse('Shop not found');

    const limit = verificationLimiter.check(`user:${merchant.userId}`);
    if (!limit.allowed) return tooManyChecksResponse(limit.retryAfterMs);

    const result = await ShopVerificationService.verify(merchant.userId, shopId);
    if (result.ok) return successResponse({ verified: true });

    if (result.reason === 'NOT_FOUND') return notFoundResponse('Shop not found');
    return result.reason === 'NO_RECORD'
      ? NextResponse.json({ success: false, code: 'NO_RECORD', message: NO_RECORD_MESSAGE }, { status: 422 })
      : NextResponse.json({ success: false, code: 'LOOKUP_FAILED', message: LOOKUP_FAILED_MESSAGE }, { status: 503 });
  } catch (error) {
    console.error('Error verifying shop:', error);
    return internalServerErrorResponse();
  }
}
