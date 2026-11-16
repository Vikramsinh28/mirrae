'use client';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCurrentCredits } from '@/hooks/useCurrentCredits';
import { creditLevel } from '@/lib/credits/level';
import { openCreditPurchase } from '@/store/ui/modals';

/** Tells the merchant, before shoppers notice, that credits are running low or out. Renders nothing otherwise. */
export function LowCreditBanner() {
  const credits = useCurrentCredits();
  const level = creditLevel(credits);
  if (level === 'ok' || credits === undefined) return null;

  const empty = level === 'empty';
  const colors = empty
    ? 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-400'
    : 'bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-300';

  return (
    <div role={empty ? 'alert' : 'status'} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-xs ${colors}`}>
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          {empty
            ? 'You are out of credits. Shoppers now see "Try-on is temporarily unavailable" until you add more.'
            : `You have ${credits.toFixed(1)} credits left. Each try-on uses 1 or 2, so add more before they run out.`}
        </span>
      </span>
      <Button type="button" size="sm" variant={empty ? 'default' : 'outline'} onClick={openCreditPurchase}>
        Buy credits
      </Button>
    </div>
  );
}
