/**
 * How worried a merchant should be about their credit balance. A front-view try-on costs 1 credit and a
 * three-view one 2, so under 1 credit nothing can start, and shoppers then see "temporarily unavailable".
 */

export type CreditLevel = 'ok' | 'low' | 'empty';

export const LOW_CREDIT_THRESHOLD = 10;
const CHEAPEST_TRY_ON = 1;

export function creditLevel(credits: number | undefined): CreditLevel {
  if (credits === undefined) return 'ok';
  if (credits < CHEAPEST_TRY_ON) return 'empty';
  return credits < LOW_CREDIT_THRESHOLD ? 'low' : 'ok';
}
