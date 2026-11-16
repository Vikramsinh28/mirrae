'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useShopUsage } from '@/hooks/useShops';
import type { ShopUsage } from '@/services/api/shops';

const RANGES = [7, 30, 90] as const;
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

function UsageDetails({ usage }: { usage: ShopUsage }) {
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

export function ShopUsageCard({ shopId }: { shopId: string }) {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError } = useShopUsage(shopId, days);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Usage</CardTitle>
            <CardDescription>What shoppers did on this shop in the last {days} days.</CardDescription>
          </div>
          <div role="group" aria-label="Time range" className="flex gap-1">
            {RANGES.map(range => (
              <Button key={range} type="button" size="sm" variant={range === days ? 'default' : 'outline'} aria-pressed={range === days} onClick={() => setDays(range)}>
                {range} days
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-32 rounded-lg" />}
        {isError && <p role="alert" className="text-destructive text-xs">Could not load usage. Please try again.</p>}
        {data && <UsageDetails usage={data} />}
      </CardContent>
    </Card>
  );
}
