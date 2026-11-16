'use client';

import { CheckCircle2, Circle, Coins } from 'lucide-react';
import Link from 'next/link';

import { CreditDisplay } from '@/components/atom/CreditDisplay';
import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSetupStatus, useShops } from '@/hooks/useShops';
import { openCreditPurchase } from '@/store/ui/modals';

interface ChecklistItem {
  label: string;
  done: boolean;
  href: string;
  action: string;
}

function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ol className="grid gap-2">
      {items.map(item => (
        <li key={item.label} className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-2">
            {item.done ? <CheckCircle2 className="size-4 text-emerald-600" aria-label="Done" /> : <Circle className="text-text-muted size-4" aria-label="To do" />}
            <span className={item.done ? 'text-text-muted line-through' : 'text-text'}>{item.label}</span>
          </span>
          {!item.done && (
            <Button asChild size="sm" variant="outline">
              <Link href={item.href}>{item.action}</Link>
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}

export function OverviewPage() {
  const { data: shops, isLoading } = useShops();
  const { data: setup } = useSetupStatus();

  const shopCount = shops?.length ?? 0;
  const tryOns = shops?.reduce((sum, shop) => sum + shop.tryOnsLast7Days, 0) ?? 0;
  const firstShop = shops?.[0];

  const checklist: ChecklistItem[] = [
    { label: 'Add your shop', done: shopCount > 0, href: '/app/shops', action: 'Add shop' },
    { label: 'Try it on your own product', done: setup?.testedTryOn ?? false, href: '/app/try', action: 'Try it' },
    {
      label: 'Paste the code on your website',
      done: tryOns > 0,
      href: firstShop ? `/app/shops/${firstShop.id}` : '/app/shops',
      action: 'Get the code',
    },
    { label: 'Get your first shopper try-on', done: tryOns > 0, href: firstShop ? `/app/shops/${firstShop.id}` : '/app/shops', action: 'See how' },
  ];

  return (
    <div className="min-h-screen">
      <PageHeaderWithAction title="Home" description="How your try-on button is doing" />

      <div className="grid gap-4 p-4 max-sm:p-3 lg:grid-cols-[2fr_1fr]">
        <div className="grid content-start gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card size="sm" className="gap-0 py-0">
              <CardContent className="px-3 py-2">
                <CardDescription className="text-text-muted text-xs">Credits left</CardDescription>
                <div className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
                  <Coins className="size-5 text-yellow-500" />
                  <CreditDisplay showIcon={false} />
                </div>
                <Button type="button" size="sm" variant="link" className="h-auto px-0" onClick={openCreditPurchase}>
                  Buy credits
                </Button>
              </CardContent>
            </Card>
            <Card size="sm" className="gap-0 py-0">
              <CardContent className="px-3 py-2">
                <CardDescription className="text-text-muted text-xs">Shops</CardDescription>
                <div className="mt-1.5 text-lg font-semibold">{isLoading ? <Skeleton className="h-6 w-8" /> : shopCount}</div>
              </CardContent>
            </Card>
            <Card size="sm" className="gap-0 py-0">
              <CardContent className="px-3 py-2">
                <CardDescription className="text-text-muted text-xs">Try-ons, last 7 days</CardDescription>
                <div className="mt-1.5 text-lg font-semibold">{isLoading ? <Skeleton className="h-6 w-8" /> : tryOns}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your shops</CardTitle>
              <CardDescription>
                <Link href="/app/shops" className="text-primary underline">Open all shops</Link> to see the code, usage and settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shops && shops.length > 0 ? (
                <ul className="grid gap-1.5 text-xs">
                  {shops.map(shop => (
                    <li key={shop.id} className="flex justify-between gap-2">
                      <Link href={`/app/shops/${shop.id}`} className="text-text truncate underline-offset-2 hover:underline">{shop.name}</Link>
                      <span className="text-text-muted shrink-0">{shop.tryOnsLast7Days} try-ons</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted text-xs">{isLoading ? 'Loading…' : 'No shops yet.'}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="content-start">
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>Four steps to your first shopper try-on.</CardDescription>
          </CardHeader>
          <CardContent>
            <Checklist items={checklist} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
