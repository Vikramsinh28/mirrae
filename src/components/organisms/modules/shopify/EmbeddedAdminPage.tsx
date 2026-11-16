'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useShopifyAdmin } from '@/hooks/useShopifyAdmin';
import { creditLevel } from '@/lib/credits/level';
import { themeEditorLink } from '@/lib/shopify/links';
import type { ShopifyOverview } from '@/services/api/shopify-admin';

import { UsageDetails, UsageRangePicker } from '../shops/ShopUsageDetails';

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const colors = {
    info: 'bg-muted text-text',
    warn: 'bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-300',
    error: 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-400',
  }[tone];
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg p-3 text-xs ${colors}`}>
      {children}
    </p>
  );
}

function CreditsCard({ credits }: { credits: number }) {
  const level = creditLevel(credits);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credits</CardTitle>
        <CardDescription>Each try-on uses 1 credit (front view) or 2 (front, side and back).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-text text-2xl font-semibold">{credits.toFixed(1)}</p>
        {level === 'empty' && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-400/10 dark:text-red-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            You are out of credits. Shoppers see &quot;Try-on is temporarily unavailable&quot; until you add more.
          </p>
        )}
        {level === 'low' && (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Credits are running low.
          </p>
        )}
        <p className="text-text-muted text-xs">Buying credits through your Shopify bill is coming soon.</p>
      </CardContent>
    </Card>
  );
}

function SetupCard({ overview, apiKey }: { overview: ShopifyOverview; apiKey: string }) {
  const link = themeEditorLink(overview.shop.domain, apiKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Show the try-on button on your store</CardTitle>
        <CardDescription>Turn on the Mirrae app embed in your theme, then save. Nothing to copy or paste.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Open in the top window: the theme editor cannot load inside this frame */}
        <Button type="button" size="sm" disabled={!link} onClick={() => link && window.open(link, '_top')}>
          Open theme editor
        </Button>
      </CardContent>
    </Card>
  );
}

function Dashboard({ apiKey }: { apiKey: string }) {
  const [days, setDays] = useState<number>(30);
  const { overview, setLive } = useShopifyAdmin(apiKey, days);

  if (overview.isLoading) return <Skeleton className="h-64 rounded-lg" />;
  if (overview.isError || !overview.data) {
    return (
      <div className="grid gap-3">
        <Notice tone="error">{overview.error instanceof Error ? overview.error.message : 'Could not load your shop.'}</Notice>
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => void overview.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { shop } = overview.data;
  const switchable = shop.status === 'ACTIVE' || shop.status === 'PAUSED';

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-text text-sm font-medium">{shop.name}</p>
            <p className="text-text-muted text-xs">{shop.domain}</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="shop-live"
              checked={shop.status === 'ACTIVE'}
              disabled={!switchable || setLive.isPending}
              onCheckedChange={live => setLive.mutate(live ? 'ACTIVE' : 'PAUSED')}
            />
            <Label htmlFor="shop-live" className="text-xs">
              {shop.status === 'ACTIVE' ? 'Live' : shop.status === 'PAUSED' ? 'Paused' : 'Unavailable'}
            </Label>
          </div>
        </CardContent>
      </Card>
      {setLive.isError && <Notice tone="error">{setLive.error.message}</Notice>}
      {shop.status === 'SUSPENDED' && <Notice tone="error">This shop has been suspended, so shoppers cannot use the button. Please contact support.</Notice>}

      <SetupCard overview={overview.data} apiKey={apiKey} />
      <CreditsCard credits={overview.data.credits} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Usage</CardTitle>
              <CardDescription>What shoppers did on your store in the last {days} days.</CardDescription>
            </div>
            <UsageRangePicker days={days} onChange={setDays} />
          </div>
        </CardHeader>
        <CardContent>
          <UsageDetails usage={overview.data.usage} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Mirrae's page inside the Shopify admin. Authenticated by the Shopify session token, never by a Mirrae login. */
export function EmbeddedAdminPage({ apiKey }: { apiKey: string }) {
  const { bridge, embedded } = useShopifyAdmin(apiKey, 30);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 max-sm:p-3">
      <h1 className="text-text text-lg font-semibold">Mirrae virtual try-on</h1>

      {bridge.isLoading && <Skeleton className="h-64 rounded-lg" />}
      {bridge.isError && <Notice tone="error">We could not connect to Shopify. Please reload this page.</Notice>}
      {bridge.isSuccess && !embedded && <Notice>Open Mirrae from your Shopify admin (Apps, then Mirrae) to manage your store.</Notice>}
      {embedded && <Dashboard apiKey={apiKey} />}
    </div>
  );
}
