import {
  conflictResponse,
  requireMerchant,
} from '@/app/api/shops/shop-route-helpers';
import {
  internalServerErrorResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/utils/response/response';
import { formatZodError } from '@/lib/utils/validation/validation';
import { MAX_SHOPS_PER_OWNER, ShopService } from '@/services/internal/shop';
import { createShopSchema } from '@/validations/shop';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    return successResponse({ shops: await ShopService.list(merchant.userId) });
  } catch (error) {
    console.error('Error listing shops:', error);
    return internalServerErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const parsed = createShopSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationErrorResponse('Invalid input data', formatZodError(parsed.error));

    const result = await ShopService.create(merchant.userId, parsed.data);
    if (result.ok) return successResponse({ shop: result.shop }, 201);

    return conflictResponse(
      result.reason === 'LIMIT_REACHED'
        ? `You can have up to ${MAX_SHOPS_PER_OWNER} shops.`
        : 'This website is already registered. If it is yours, contact support.'
    );
  } catch (error) {
    console.error('Error creating shop:', error);
    return internalServerErrorResponse();
  }
}
