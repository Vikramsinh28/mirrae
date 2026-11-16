'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ShopConversion, ShopUsage } from '@/services/api/shops';

export const USAGE_RANGES = [7, 30, 90] as const;

const FAILURE_LABELS: Record<string, string> = {
  NO_PERSON: 'No person in the photo',
  MULTIPLE_PEOPLE: 'More than one person in the photo',
  PERSON_TOO_SMALL: 'Person too small or cut off',
  NOT_CLOTHING: 'Product image is not clothing',
  OTHER: 'Other or technical problem',
};
const STATUS_BADGES: Record<string, { label: string; variant: 'success' | 'error' | 'info' }> = {
  DONE: { label: 'Done', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'error' },
  QUEUED: { label: 'Waiting', variant: 'info' },
  PROCESSING: { label: 'Working', variant: 'info' },
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-text-muted text-xs">{label}</p>
      <p className="text-text text-xl font-semibold">{value}</p>
      {hint && <p className="text-text-muted text-[11px]">{hint}</p>}
    </div>
  );
}

function ConversionSection({ conversion }: { conversion: ShopConversion }) {
  const { opened, sawResult, addedToCart, shared, addToCartRate } = conversion;
  const rate = addToCartRate === null ? '–' : `${Math.round(addToCartRate * 100)}%`;

  return (
    <div>
      <p className="text-text mb-1.5 text-xs font-medium">What shoppers did</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Opened try-on" value={opened} hint="shoppers" />
        <Stat label="Saw a result" value={sawResult} hint="shoppers" />
        <Stat label="Added to cart" value={addedToCart} hint={`${rate} of those who saw a result`} />
        <Stat label="Saved or shared" value={shared} hint="shoppers" />
      </div>
      <p className="text-text-muted mt-1.5 text-[11px]">
        Counted from the try-on window only. It shows how many shoppers added to cart after trying on; it does not prove the
        try-on caused the sale.
      </p>
    </div>
  );
}

export function UsageDetails({ usage }: { usage: ShopUsage }) {
  const finished = usage.jobs.done + usage.jobs.failed;
  const successRate = finished === 0 ? '–' : `${Math.round((usage.jobs.done / finished) * 100)}%`;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Try-ons started" value={usage.jobs.total} />
        <Stat label="Completed" value={usage.jobs.done} hint={`${successRate} success`} />
        <Stat label="Credits used" value={usage.creditsSpent} />
        <Stat label="Today" value={`${usage.startedToday} / ${usage.dailyTryOnCap}`} hint="daily limit" />
      </div>

      <ConversionSection conversion={usage.conversion} />

      {usage.failureReasons.length > 0 && (
        <div>
          <p className="text-text mb-1.5 text-xs font-medium">Why some try-ons did not work</p>
          <ul className="text-text-muted grid gap-1 text-xs">
            {usage.failureReasons.map(reason => (
              <li key={reason.code} className="flex justify-between gap-2">
                <span>{FAILURE_LABELS[reason.code] ?? reason.code}</span>
                <span className="text-text font-medium">{reason.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {usage.recent.length === 0 ? (
        <p className="text-text-muted text-xs">No try-ons yet. Once shoppers start trying clothes on, they show up here.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Views</TableHead>
              <TableHead className="text-right">Charged</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.recent.map(job => {
              const badge = STATUS_BADGES[job.status] ?? { label: job.status, variant: 'info' as const };
              return (
                <TableRow key={job.id}>
                  <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {job.failureCode && <span className="text-text-muted ml-2">{FAILURE_LABELS[job.failureCode] ?? ''}</span>}
                  </TableCell>
                  <TableCell>{job.viewCount > 1 ? 'Front, side, back' : 'Front'}</TableCell>
                  <TableCell className="text-right">{job.charged ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}


/** The 7 / 30 / 90 day buttons above a usage report. */
export function UsageRangePicker({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  return (
    <div role="group" aria-label="Time range" className="flex gap-1">
      {USAGE_RANGES.map(range => (
        <Button key={range} type="button" size="sm" variant={range === days ? 'default' : 'outline'} aria-pressed={range === days} onClick={() => onChange(range)}>
          {range} days
        </Button>
      ))}
    </div>
  );
}
