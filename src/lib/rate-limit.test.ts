import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  let now = 1_000_000;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000_000;
  });

  test('allows up to the limit inside a window, then blocks with a retry time', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock });

    const results = [1, 2, 3, 4].map(() => limiter.check('ip-1'));

    expect(results.map(result => result.allowed)).toEqual([true, true, true, false]);
    expect(results[0].remaining).toBe(2);
    expect(results[3]).toMatchObject({ allowed: false, remaining: 0 });
    expect(results[3].retryAfterMs).toBeGreaterThan(0);
    expect(results[3].retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  test('keeps separate counts per key', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock });

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
  });

  test('starts a fresh window after the window has passed', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock });
    limiter.check('a');
    expect(limiter.check('a').allowed).toBe(false);

    now += 60_001;

    expect(limiter.check('a').allowed).toBe(true);
  });

  test('forgets finished windows so memory does not grow without bound', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, maxKeys: 5, now: clock });
    for (let index = 0; index < 5; index++) limiter.check(`old-${index}`);
    now += 2_000;

    limiter.check('fresh');

    expect(limiter.size()).toBe(1);
  });

  test('never tracks more than maxKeys at once: when full of live keys it blocks new ones (fail closed)', () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 2, now: clock });
    limiter.check('a');
    limiter.check('b');

    expect(limiter.check('c').allowed).toBe(false);
    expect(limiter.size()).toBe(2);
    expect(limiter.check('a').allowed).toBe(true);
  });

  test.each([0, -1, 1.5, Number.NaN])('rejects an invalid limit %p', limit => {
    expect(() => createRateLimiter({ limit, windowMs: 1000 })).toThrow();
  });
});
