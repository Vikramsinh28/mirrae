import { parseShopId, requireMerchant } from '@/app/api/shops/shop-route-helpers';
import { internalServerErrorResponse, notFoundResponse, successResponse } from '@/lib/utils/response/response';
import { ShopVerificationService } from '@/services/internal/shop-verification';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** The DNS record the merchant adds to prove they own the website, and whether the shop is verified already. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const shopId = parseShopId((await params).id);
    if (!shopId) return notFoundResponse('Shop not found');

    const result = await ShopVerificationService.instructions(merchant.userId, shopId);
    return result.ok ? successResponse({ verified: result.verified, record: result.record }) : notFoundResponse('Shop not found');
  } catch (error) {
    console.error('Error reading shop verification:', error);
    return internalServerErrorResponse();
  }
}
