import { createRateLimiter } from '@/lib/rate-limit';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Per-process limits for the anonymous storefront API. Every try-on costs real money, so these are the
 * first line against bots; the per-shop daily cap and the merchant's credits are the second.
 */
export const storefrontLimits = {
  sessionByIp: createRateLimiter({ limit: 30, windowMs: MINUTE_MS }),
  photoBySession: createRateLimiter({ limit: 10, windowMs: MINUTE_MS }),
  photoByIp: createRateLimiter({ limit: 60, windowMs: HOUR_MS }),
  tryOnBySession: createRateLimiter({ limit: 5, windowMs: MINUTE_MS }),
  tryOnByIp: createRateLimiter({ limit: 30, windowMs: HOUR_MS }),
};
