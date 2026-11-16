import { parseShopId, requireMerchant } from '@/app/api/shops/shop-route-helpers';
import { internalServerErrorResponse, notFoundResponse, successResponse } from '@/lib/utils/response/response';
import { ShopService } from '@/services/internal/shop';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Gives the shop a new public key. The old key stops working at once, so the snippet on the site must be updated. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const shopId = parseShopId((await params).id);
    if (!shopId) return notFoundResponse('Shop not found');

    const result = await ShopService.rotateKey(merchant.userId, shopId);
    return result.ok ? successResponse({ shop: result.shop }) : notFoundResponse('Shop not found');
  } catch (error) {
    console.error('Error rotating shop key:', error);
    return internalServerErrorResponse();
  }
}
