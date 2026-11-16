'use client';

import { CheckCircle2, Circle, Coins } from 'lucide-react';
import Link from 'next/link';

import { CreditDisplay } from '@/components/atom/CreditDisplay';
import { LowCreditBanner } from '@/components/molecules/common/LowCreditBanner';
import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSetupStatus, useShops } from '@/hooks/useShops';
import { buildChecklist, type Checklist as ChecklistModel } from '@/lib/shops/setup-checklist';
import { openCreditPurchase } from '@/store/ui/modals';

function Checklist({ checklist }: { checklist: ChecklistModel }) {
  const percent = Math.round((checklist.doneCount / checklist.total) * 100);

  return (
    <div className="grid gap-3">
      <div>
        <div className="text-text-muted mb-1 flex justify-between text-[11px]">
          <span>
            {checklist.doneCount} of {checklist.total} done
          </span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full" role="progressbar" aria-label="Setup progress" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="bg-primary h-full rounded-full transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ol className="grid gap-3">
        {checklist.steps.map(step => {
          const isNext = checklist.next?.id === step.id;
          return (
            <li key={step.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="flex items-start gap-2">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Done" />
                ) : (
                  <Circle className="text-text-muted mt-0.5 size-4 shrink-0" aria-label="To do" />
                )}
                <span>
                  <span className={step.done ? 'text-text-muted line-through' : 'text-text font-medium'}>{step.label}</span>
                  {!step.done && <span className="text-text-muted block">{step.hint}</span>}
                </span>
              </span>
              {!step.done && (
                <Button asChild size="sm" variant={isNext ? 'default' : 'outline'} className="shrink-0">
                  <Link href={step.href}>{step.action}</Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function OverviewPage() {
  const { data: shops, isLoading } = useShops();
  const { data: setup } = useSetupStatus();

  const shopCount = shops?.length ?? 0;
  const tryOns = shops?.reduce((sum, shop) => sum + shop.tryOnsLast7Days, 0) ?? 0;
  const checklist = buildChecklist(shops ?? [], setup);

  return (
    <div className="min-h-screen">
      <PageHeaderWithAction title="Home" description="How your try-on button is doing" />

      <div className="px-4 pt-4 max-sm:px-3 max-sm:pt-3 empty:hidden">
        <LowCreditBanner />
      </div>

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

        <Card className={`content-start ${checklist.complete ? '' : 'max-lg:order-first'}`}>
          <CardHeader>
            <CardTitle>{checklist.complete ? 'You are all set' : 'Get started'}</CardTitle>
            <CardDescription>
              {checklist.complete ? 'Your try-on button is live and shoppers are using it.' : 'Four steps to your first shopper try-on.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Checklist checklist={checklist} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
