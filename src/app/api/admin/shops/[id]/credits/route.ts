import { requireAdmin } from '@/app/api/admin/admin-route-helpers';
import { parseShopId } from '@/app/api/shops/shop-route-helpers';
import { internalServerErrorResponse, notFoundResponse, successResponse, validationErrorResponse } from '@/lib/utils/response/response';
import { formatZodError } from '@/lib/utils/validation/validation';
import { AdminService } from '@/services/internal/admin';
import { adminCreditAdjustmentSchema } from '@/validations/admin-shops';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Gives credits to, or takes them from, the account that pays for a shop. Needs a reason; every change is recorded. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const shopId = parseShopId((await params).id);
    if (!shopId) return notFoundResponse('Shop not found');

    const body = adminCreditAdjustmentSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return validationErrorResponse('Invalid input data', formatZodError(body.error));

    const result = await AdminService.adjustCredits(admin.adminId, shopId, body.data);
    if (result.ok) return successResponse({ balance: result.balance });

    return result.reason === 'NOT_FOUND'
      ? notFoundResponse('Shop not found')
      : NextResponse.json({ success: false, message: 'That would take the balance below zero' }, { status: 409 });
  } catch (error) {
    console.error('Error adjusting credits as admin:', error);
    return internalServerErrorResponse();
  }
}
