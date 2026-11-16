import { requireAdmin } from '@/app/api/admin/admin-route-helpers';
import { internalServerErrorResponse, successResponse, validationErrorResponse } from '@/lib/utils/response/response';
import { formatZodError } from '@/lib/utils/validation/validation';
import { AdminService } from '@/services/internal/admin';
import { adminStatsQuerySchema } from '@/validations/admin-shops';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Platform-wide numbers for the admin overview. */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const query = adminStatsQuerySchema.safeParse({ days: request.nextUrl.searchParams.get('days') ?? undefined });
    if (!query.success) return validationErrorResponse('Invalid input data', formatZodError(query.error));

    return successResponse({ overview: await AdminService.overview(query.data.days) });
  } catch (error) {
    console.error('Error loading admin overview:', error);
    return internalServerErrorResponse();
  }
}
