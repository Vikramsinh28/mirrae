import { NextResponse } from 'next/server';

import { getAuthUser } from '@/lib/auth/jwt';
import { UserRole } from '@/lib/prisma/generated/client';
import { unauthorizedResponse } from '@/lib/utils/response/response';
import { getUserById } from '@/services/repositories/user';

/**
 * The admin routes are also protected by the role rules in the route config, but every handler checks the role
 * itself as well: a mistake in one place must not expose every merchant's data.
 */

type AdminCheck = { ok: true; adminId: number } | { ok: false; response: NextResponse };

export async function requireAdmin(request: Parameters<typeof getAuthUser>[0]): Promise<AdminCheck> {
  const { userId } = (await getAuthUser(request)) || {};
  const user = await getUserById(userId);
  if (!user) return { ok: false, response: unauthorizedResponse() };
  // A real 403 (the shared forbiddenResponse helper answers 401)
  if (user.role !== UserRole.ADMIN) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 }) };
  }
  return { ok: true, adminId: user.id };
}
