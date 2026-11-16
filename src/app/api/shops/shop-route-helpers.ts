import { NextResponse } from 'next/server';

import { TOO_MANY_CHECKS_MESSAGE } from '@/lib/shops/verification-messages';

import { getAuthUser } from '@/lib/auth/jwt';
import { getUserById } from '@/services/repositories/user';
import { z } from 'zod';

import { unauthorizedResponse } from '@/lib/utils/response/response';

/** Small helpers shared by the merchant shop routes. */

const shopIdSchema = z.string().uuid();

type SignedIn = { ok: true; userId: number } | { ok: false; response: NextResponse };

/** The signed-in merchant, or the 401 response to return. */
export async function requireMerchant(request: Parameters<typeof getAuthUser>[0]): Promise<SignedIn> {
  const { userId } = (await getAuthUser(request)) || {};
  const user = await getUserById(userId);
  return user ? { ok: true, userId: user.id } : { ok: false, response: unauthorizedResponse() };
}

/** A shop id from the url, or null when it is not a uuid (such a shop cannot exist, so the route answers 404). */
export const parseShopId = (value: string): string | null => {
  const parsed = shopIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const conflictResponse = (message: string, code?: string) =>
  NextResponse.json({ success: false, message, ...(code ? { code } : {}) }, { status: 409 });

export const forbiddenMessage = (message: string) =>
  NextResponse.json({ success: false, message }, { status: 403 });

/** Too many DNS checks from this merchant: the same answer from the verify and claim routes. */
export const tooManyChecksResponse = (retryAfterMs: number) =>
  NextResponse.json(
    { success: false, message: TOO_MANY_CHECKS_MESSAGE },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
  );
