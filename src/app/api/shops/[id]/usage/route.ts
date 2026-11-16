import { parseShopId, requireMerchant } from '@/app/api/shops/shop-route-helpers';
import {
  internalServerErrorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/utils/response/response';
import { formatZodError } from '@/lib/utils/validation/validation';
import { ShopService } from '@/services/internal/shop';
import { usageQuerySchema } from '@/validations/shop';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const merchant = await requireMerchant(request);
    if (!merchant.ok) return merchant.response;

    const shopId = parseShopId((await params).id);
    if (!shopId) return notFoundResponse('Shop not found');

    const query = usageQuerySchema.safeParse({ days: request.nextUrl.searchParams.get('days') ?? undefined });
    if (!query.success) return validationErrorResponse('Invalid input data', formatZodError(query.error));

    const result = await ShopService.usage(merchant.userId, shopId, query.data.days);
    return result.ok ? successResponse({ usage: result.usage }) : notFoundResponse('Shop not found');
  } catch (error) {
    console.error('Error fetching shop usage:', error);
    return internalServerErrorResponse();
  }
}
