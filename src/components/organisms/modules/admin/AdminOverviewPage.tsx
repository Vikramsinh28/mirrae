'use client';

import Link from 'next/link';
import { useState } from 'react';

import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminOverview } from '@/hooks/useAdminShops';
import type { AdminOverview } from '@/services/api/admin';

import { Stat, UsageRangePicker } from '../shops/ShopUsageDetails';

const FAILURE_LABELS: Record<string, string> = {
  NO_PERSON: 'No person in the photo',
  MULTIPLE_PEOPLE: 'More than one person in the photo',
  PERSON_TOO_SMALL: 'Person too small or cut off',
  NOT_CLOTHING: 'Product image is not clothing',
  OTHER: 'Other or technical problem',
};

const percent = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)}%`);

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Attention({ overview }: { overview: AdminOverview }) {
  const { outOfCredits, highFailure } = overview.attention;
  if (outOfCredits.length === 0 && highFailure.length === 0) {
    return <p className="text-text-muted text-xs">Nothing needs attention right now.</p>;
  }

  return (
    <div className="grid gap-4 text-xs">
      {outOfCredits.length > 0 && (
        <div>
          <p className="text-text mb-1.5 font-medium">Live shops that are out of credits (shoppers see &quot;unavailable&quot;)</p>
          <ul className="grid gap-1">
            {outOfCredits.map(shop => (
              <li key={shop.id} className="flex justify-between gap-2">
                <span className="truncate">{shop.name} <span className="text-text-muted">{shop.domain}</span></span>
                <span className="text-text-muted shrink-0">{shop.credits.toFixed(1)} credits</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {highFailure.length > 0 && (
        <div>
          <p className="text-text mb-1.5 font-medium">Shops where many try-ons fail</p>
          <ul className="grid gap-1">
            {highFailure.map(shop => (
              <li key={shop.id} className="flex justify-between gap-2">
                <span className="truncate">{shop.name} <span className="text-text-muted">{shop.domain}</span></span>
                <span className="text-text-muted shrink-0">
                  {shop.failed} of {shop.total} failed ({percent(shop.failureRate)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Details({ overview }: { overview: AdminOverview }) {
  const { jobs, conversion, shopify, shopsByStatus } = overview;
  const addToCartRate = conversion.sawResult === 0 ? null : Math.min(1, conversion.addedToCart / conversion.sawResult);

  return (
    <div className="grid gap-4">
      <Section title="Needs attention">
        <Attention overview={overview} />
      </Section>

      <Section title="Merchants and shops" description={`${overview.newShops} new shops in the last ${overview.days} days.`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Merchants" value={overview.merchants} />
          <Stat label="Live shops" value={shopsByStatus.ACTIVE ?? 0} />
          <Stat label="Paused or suspended" value={(shopsByStatus.PAUSED ?? 0) + (shopsByStatus.SUSPENDED ?? 0)} />
          <Stat label="Removed" value={shopsByStatus.UNINSTALLED ?? 0} />
        </div>
      </Section>

      <Section title="Try-ons">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Started" value={jobs.total} hint={`${jobs.startedToday} today (UTC)`} />
          <Stat label="Completed" value={jobs.done} hint={`${percent(jobs.successRate)} success`} />
          <Stat label="Failed" value={jobs.failed} />
          <Stat label="Credits used" value={overview.creditsSpent} />
        </div>
        {overview.failureReasons.length > 0 && (
          <ul className="text-text-muted mt-3 grid gap-1 text-xs">
            {overview.failureReasons.map(reason => (
              <li key={reason.code} className="flex justify-between gap-2">
                <span>{FAILURE_LABELS[reason.code] ?? reason.code}</span>
                <span className="text-text font-medium">{reason.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="What shoppers did" description="Counted in shopper sessions, across all shops.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Opened try-on" value={conversion.opened} />
          <Stat label="Saw a result" value={conversion.sawResult} />
          <Stat label="Added to cart" value={conversion.addedToCart} hint={`${percent(addToCartRate)} of those who saw a result`} />
          <Stat label="Saved or shared" value={conversion.shared} />
        </div>
      </Section>

      <Section title="Shopify billing" description="Test charges are never billed, so they are not counted as revenue.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Paid purchases" value={shopify.liveCharges} />
          <Stat label="Revenue" value={`$${shopify.liveRevenueUsd.toFixed(2)}`} />
          <Stat label="Test purchases" value={shopify.testCharges} />
        </div>
      </Section>
    </div>
  );
}

export function AdminOverviewPage() {
  const [days, setDays] = useState<number>(7);
  const { data, isLoading, isError } = useAdminOverview(days);

  return (
    <div className="min-h-screen">
      <PageHeaderWithAction
        title="Platform overview"
        description="How Mirrae is doing across all merchants"
        actions={
          <div className="flex items-center gap-3 pr-4">
            <Link href="/app/admin/shops" className="text-primary text-xs underline">All shops</Link>
            <UsageRangePicker days={days} onChange={setDays} />
          </div>
        }
      />
      <div className="mx-auto w-full max-w-4xl p-4 max-sm:p-3">
        {isLoading && <Skeleton className="h-64 rounded-lg" />}
        {isError && <p role="alert" className="text-destructive text-xs">Could not load the overview. Please try again.</p>}
        {data && <Details overview={data} />}
      </div>
    </div>
  );
}
