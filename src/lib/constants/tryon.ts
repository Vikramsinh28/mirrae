/** Try-on pricing and reservation rules shared by the service and the repository. */

export const VIEW_COUNT = { single: 1, multi: 3 } as const;

export const CREDITS_SINGLE_VIEW = 1;
// 3 views (front + side + back) cost 2 credits; if an extra view fails the shopper pays only 1.
export const CREDITS_FULL_SET = 2;

/** Credits a job costs when everything is delivered, from its stored view count. */
export const creditsForViewCount = (viewCount: number): number =>
  viewCount > VIEW_COUNT.single ? CREDITS_FULL_SET : CREDITS_SINGLE_VIEW;

/**
 * A job that is still running (or finished but not yet charged) holds its credits back from new jobs, so
 * several jobs started at once cannot all finish unpaid. A job silent for longer than this window stops
 * holding credits, so a crashed worker never locks a balance forever.
 */
export const RESERVATION_WINDOW_MS = 10 * 60 * 1000;
