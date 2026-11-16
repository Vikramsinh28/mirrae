import { forbiddenMessage, parseShopId, requireMerchant } from '@/app/api/shops/shop-route-helpers';
import {
  internalServerErrorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/utils/response/response';
import { formatZodError } from '@/lib/utils/validation/validation';
import { ShopService } from '@/services/internal/shop';
import { updateShopSchema } from '@/validations/shop';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const shopId = parseShopId((await params).id);
    const shop = shopId ? await ShopService.get(merchant.userId, shopId) : null;
    return shop ? successResponse({ shop }) : notFoundResponse('Shop not found');
  } catch (error) {
    console.error('Error fetching shop:', error);
    return internalServerErrorResponse();
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const shopId = parseShopId((await params).id);
    if (!shopId) return notFoundResponse('Shop not found');

    const parsed = updateShopSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationErrorResponse('Invalid input data', formatZodError(parsed.error));

    const result = await ShopService.update(merchant.userId, shopId, parsed.data);
    if (result.ok) return successResponse({ shop: result.shop });

    return result.reason === 'NOT_FOUND'
      ? notFoundResponse('Shop not found')
      : forbiddenMessage('This shop is suspended. Contact support to change its status.');
  } catch (error) {
    console.error('Error updating shop:', error);
    return internalServerErrorResponse();
  }
}
