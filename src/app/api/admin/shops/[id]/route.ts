import { requireAdmin } from '@/app/api/admin/admin-route-helpers';
import { parseShopId } from '@/app/api/shops/shop-route-helpers';
import { internalServerErrorResponse, notFoundResponse, successResponse, validationErrorResponse } from '@/lib/utils/response/response';
import { formatZodError } from '@/lib/utils/validation/validation';
import { AdminService } from '@/services/internal/admin';
import { adminShopStatusSchema, adminStatsQuerySchema } from '@/validations/admin-shops';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** One shop for the admin: details, paying account, usage and the admin history. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const shopId = parseShopId((await params).id);
    if (!shopId) return notFoundResponse('Shop not found');

    const query = adminStatsQuerySchema.safeParse({ days: request.nextUrl.searchParams.get('days') ?? undefined });
    if (!query.success) return validationErrorResponse('Invalid input data', formatZodError(query.error));

    const result = await AdminService.shopDetail(shopId, query.data.days);
    return result.ok ? successResponse(result.detail) : notFoundResponse('Shop not found');
  } catch (error) {
    console.error('Error loading shop for admin:', error);
    return internalServerErrorResponse();
  }
}

/** Suspends a shop (shoppers stop being served at once) or lets it back in. The change is recorded with the admin's name. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const shopId = parseShopId((await params).id);
    if (!shopId) return notFoundResponse('Shop not found');

    const body = adminShopStatusSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return validationErrorResponse('Invalid input data', formatZodError(body.error));

    const result = await AdminService.setShopStatus(admin.adminId, shopId, body.data.status);
    if (!result.ok) {
      return result.reason === 'NOT_FOUND'
        ? notFoundResponse('Shop not found')
        : NextResponse.json({ success: false, message: 'This shop was uninstalled and cannot be changed' }, { status: 409 });
    }

    return successResponse({ status: result.status });
  } catch (error) {
    console.error('Error changing shop status as admin:', error);
    return internalServerErrorResponse();
  }
}
