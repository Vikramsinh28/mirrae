import { requireMerchant } from '@/app/api/shops/shop-route-helpers';
import { internalServerErrorResponse, successResponse } from '@/lib/utils/response/response';
import { ShopService } from '@/services/internal/shop';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Getting-started facts for the merchant dashboard checklist. */
export async function GET(request: NextRequest) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    return successResponse(await ShopService.setupStatus(merchant.userId));
  } catch (error) {
    console.error('Error reading setup status:', error);
    return internalServerErrorResponse();
  }
}
