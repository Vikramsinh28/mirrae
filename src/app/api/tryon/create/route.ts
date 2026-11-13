import { getAuthUser } from '@/lib/auth/jwt';
import {
  badRequestResponse,
  formatZodError,
  insufficientCreditsResponse,
  internalServerErrorResponse,
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from '@/lib/utils';
import { TryOnService } from '@/services/internal/tryon';
import { getUserById } from '@/services/repositories/user';
import { createTryOnSchema } from '@/validations/tryon';
import { NextRequest, after } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = (await getAuthUser(request)) || {};
    const user = await getUserById(userId);
    if (!user) return unauthorizedResponse();

    const parsed = createTryOnSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return validationErrorResponse('Invalid input data', formatZodError(parsed.error));
    }

    const result = await TryOnService.createJob({ userId: user.id, ...parsed.data });
    if (!result.ok) {
      if (result.reason === 'INSUFFICIENT_CREDITS') {
        return insufficientCreditsResponse('You need at least 1 credit to run a try-on.');
      }
      return badRequestResponse(
        result.reason === 'CONSENT_REQUIRED'
          ? 'Consent to process the photo is required'
          : 'Invalid image reference'
      );
    }

    // Runs after the response is sent; processJob never throws and fails the job on any error
    after(() => TryOnService.processJob(result.jobId));

    return successResponse({ jobId: result.jobId }, 202);
  } catch (error) {
    console.error('Error creating try-on job:', error);
    return internalServerErrorResponse();
  }
}
