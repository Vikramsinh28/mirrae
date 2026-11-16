'use client';

import Link from 'next/link';

import { LoadingScreen } from '@/components/atom/LoadingScreen';
import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useShop, useUpdateShop } from '@/hooks/useShops';

import { InstallSnippetCard } from './InstallSnippetCard';
import { ShopSettingsCard } from './ShopSettingsCard';
import { ShopStatusBadge } from './ShopStatusBadge';
import { ShopUsageCard } from './ShopUsageCard';

export function ShopDetailPage({ shopId }: { shopId: string }) {
  const { data: shop, isLoading, isError } = useShop(shopId);
  const update = useUpdateShop(shopId);

  if (isLoading) return <LoadingScreen message="Loading your shop..." />;

  if (isError || !shop) {
    return (
      <div className="min-h-screen">
        <PageHeaderWithAction title="Shop not found" />
        <div className="p-4 text-sm">
          This shop does not exist or is not yours. <Link href="/app/shops" className="text-primary underline">Back to your shops</Link>
        </div>
      </div>
    );
  }

  const switchable = shop.status === 'ACTIVE' || shop.status === 'PAUSED';

  const statusControl = (
    <div className="flex items-center gap-2 pr-4">
      <ShopStatusBadge status={shop.status} />
      <Switch
        id="shop-live"
        checked={shop.status === 'ACTIVE'}
        disabled={!switchable || update.isPending}
        onCheckedChange={live => void update.mutateAsync({ status: live ? 'ACTIVE' : 'PAUSED' }).catch(() => undefined)}
      />
      <Label htmlFor="shop-live" className="text-xs">
        {shop.status === 'ACTIVE' ? 'Live' : 'Switch on'}
      </Label>
    </div>
  );

  return (
    <div className="min-h-screen">
      <PageHeaderWithAction title={shop.name} description={shop.domain} actions={statusControl} />

      <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 max-sm:p-3">
        {shop.status === 'SUSPENDED' && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-400/10 dark:text-red-400">
            This shop has been suspended, so shoppers cannot use the button. Please contact support.
          </p>
        )}
        <InstallSnippetCard shop={shop} />
        <ShopUsageCard shopId={shop.id} />
        <ShopSettingsCard key={shop.id} shop={shop} />
      </div>
    </div>
  );
}
