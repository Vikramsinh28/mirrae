/** Midnight (UTC) at the start of the day containing `now`; the shop daily cap resets at this moment. */
export const startOfUtcDay = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export const DAY_MS = 24 * 60 * 60 * 1000;
