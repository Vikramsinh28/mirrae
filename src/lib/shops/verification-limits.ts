import { createRateLimiter } from '@/lib/rate-limit';

/** Each check makes DNS lookups on our side, so a merchant (or a script with their login) cannot ask without limit. */
export const verificationLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
