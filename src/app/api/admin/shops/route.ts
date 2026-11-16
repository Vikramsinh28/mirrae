import { requireAdmin } from '@/app/api/admin/admin-route-helpers';
import { internalServerErrorResponse, successResponse, validationErrorResponse } from '@/lib/utils/response/response';
import { formatZodError } from '@/lib/utils/validation/validation';
import { AdminService } from '@/services/internal/admin';
import { adminShopsQuerySchema } from '@/validations/admin-shops';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Every merchant's shops, with filters and paging. */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const params = request.nextUrl.searchParams;
    const query = adminShopsQuerySchema.safeParse({
      search: params.get('search'),
      status: params.get('status'),
      platform: params.get('platform'),
      limit: params.get('limit'),
      offset: params.get('offset'),
    });
    if (!query.success) return validationErrorResponse('Invalid input data', formatZodError(query.error));

    return successResponse(await AdminService.listShops(query.data));
  } catch (error) {
    console.error('Error listing shops for admin:', error);
    return internalServerErrorResponse();
  }
}
