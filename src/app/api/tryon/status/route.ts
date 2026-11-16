import { getAuthUser } from '@/lib/auth/jwt';
import {
  formatZodError,
  internalServerErrorResponse,
  notFoundResponse,
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from '@/lib/utils';
import { TryOnService } from '@/services/internal/tryon';
import { getUserById } from '@/services/repositories/user';
import { tryOnStatusQuerySchema } from '@/validations/tryon';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = (await getAuthUser(request)) || {};
    const user = await getUserById(userId);
    if (!user) return unauthorizedResponse();

    const parsed = tryOnStatusQuerySchema.safeParse({
      jobId: request.nextUrl.searchParams.get('jobId'),
    });
    if (!parsed.success) {
      return validationErrorResponse('Invalid input data', formatZodError(parsed.error));
    }

    const status = await TryOnService.getStatus(parsed.data.jobId, user.id);
    if (!status) return notFoundResponse('Try-on job not found');

    return successResponse(status);
  } catch (error) {
    console.error('Error fetching try-on status:', error);
    return internalServerErrorResponse();
  }
}
