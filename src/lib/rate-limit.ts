/**
 * In-memory fixed-window rate limiter. Fine for one long-running Node process (how this app is deployed);
 * with several instances each would count on its own, so move the counters to Redis before scaling out.
 * Fails closed: once `maxKeys` live keys are tracked, new keys are refused instead of growing memory.
 */

const DEFAULT_MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  check: (key: string) => RateLimitResult;
  size: () => number;
}

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

interface Window {
  count: number;
  resetAt: number;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('windowMs must be positive');

  const windows = new Map<string, Window>();

  const pruneFinished = (at: number) => {
    for (const [key, window] of windows) {
      if (window.resetAt <= at) windows.delete(key);
    }
  };

  return {
    check(key) {
      const at = now();
      let window = windows.get(key);

      if (window && window.resetAt <= at) {
        windows.delete(key);
        window = undefined;
      }

      if (!window) {
        if (windows.size >= maxKeys) pruneFinished(at);
        if (windows.size >= maxKeys) return { allowed: false, remaining: 0, retryAfterMs: windowMs };
        window = { count: 0, resetAt: at + windowMs };
        windows.set(key, window);
      }

      if (window.count >= limit) return { allowed: false, remaining: 0, retryAfterMs: window.resetAt - at };

      window.count += 1;
      return { allowed: true, remaining: limit - window.count, retryAfterMs: 0 };
    },
    size: () => windows.size,
  };
}
