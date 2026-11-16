import { NextResponse } from 'next/server';

import { conflictResponse, requireMerchant, tooManyChecksResponse } from '@/app/api/shops/shop-route-helpers';
import { verificationLimiter } from '@/lib/shops/verification-limits';
import { LOOKUP_FAILED_MESSAGE, NO_RECORD_MESSAGE } from '@/lib/shops/verification-messages';
import { internalServerErrorResponse, successResponse, validationErrorResponse } from '@/lib/utils/response/response';
import { formatZodError } from '@/lib/utils/validation/validation';
import { ShopVerificationService } from '@/services/internal/shop-verification';
import { createShopSchema, domainSchema } from '@/validations/shop';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** The DNS record to add to claim a website that another account registered without proving it owns it. */
export async function GET(request: NextRequest) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const domain = domainSchema.safeParse(request.nextUrl.searchParams.get('domain') ?? '');
    if (!domain.success) return validationErrorResponse('Invalid input data', formatZodError(domain.error));

    return successResponse(await ShopVerificationService.claimInstructions(merchant.userId, domain.data));
  } catch (error) {
    console.error('Error reading claim instructions:', error);
    return internalServerErrorResponse();
  }
}

/** Claims the website once the DNS record is found: the other account's unverified shop is replaced by this merchant's verified one. */
export async function POST(request: NextRequest) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const parsed = createShopSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationErrorResponse('Invalid input data', formatZodError(parsed.error));

    const limit = verificationLimiter.check(`user:${merchant.userId}`);
    if (!limit.allowed) return tooManyChecksResponse(limit.retryAfterMs);

    const result = await ShopVerificationService.claim(merchant.userId, parsed.data);
    if (result.ok) return successResponse({ shop: result.shop }, 201);

    switch (result.reason) {
      case 'NOT_CLAIMABLE':
        return conflictResponse('This website cannot be claimed. If it is yours, contact support.');
      case 'LIMIT_REACHED':
        return conflictResponse('You have reached the limit of shops.');
      case 'NO_RECORD':
        return NextResponse.json({ success: false, code: 'NO_RECORD', message: NO_RECORD_MESSAGE }, { status: 422 });
      default:
        return NextResponse.json({ success: false, code: 'LOOKUP_FAILED', message: LOOKUP_FAILED_MESSAGE }, { status: 503 });
    }
  } catch (error) {
    console.error('Error claiming website:', error);
    return internalServerErrorResponse();
  }
}
