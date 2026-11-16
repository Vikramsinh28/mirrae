'use client';

import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useShopUsage } from '@/hooks/useShops';

import { UsageDetails, UsageRangePicker } from './ShopUsageDetails';

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
          <UsageRangePicker days={days} onChange={setDays} />
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
