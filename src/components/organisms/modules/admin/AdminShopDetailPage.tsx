'use client';

import Link from 'next/link';
import { useState } from 'react';

import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminShopDetail, useSetShopStatus } from '@/hooks/useAdminShops';
import type { AdminShopDetail } from '@/services/api/admin';

import { ShopStatusBadge } from '../shops/ShopStatusBadge';
import { UsageDetails, UsageRangePicker } from '../shops/ShopUsageDetails';
import { AdminAuditCard } from './AdminAuditCard';
import { AdminCreditsCard } from './AdminCreditsCard';

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-text-muted text-[11px]">{label}</dt>
      <dd className="text-text text-xs break-all">{value}</dd>
    </div>
  );
}

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : '–');

function Details({ detail }: { detail: AdminShopDetail }) {
  const { shop, owner } = detail;
  const setStatus = useSetShopStatus();
  const suspended = shop.status === 'SUSPENDED';
  const canChange = shop.status !== 'UNINSTALLED' && !shop.uninstalledAt;

  const handleStatus = () => {
    const question = suspended
      ? `Let ${shop.name} back in? Its shoppers will be served again.`
      : `Suspend ${shop.name}? Its shoppers will stop being served at once, and the merchant cannot undo this.`;
    if (window.confirm(question)) setStatus.mutate({ id: shop.id, status: suspended ? 'ACTIVE' : 'SUSPENDED' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>{shop.name}</CardTitle>
            <CardDescription>{shop.domain}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ShopStatusBadge status={shop.status} />
            {shop.platform === 'WEB' && shop.verifiedAt === null && <Badge variant="warning">Not verified</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact label="Platform" value={shop.platform === 'SHOPIFY' ? 'Shopify' : 'Website'} />
          <Fact label="Owner" value={owner.email ?? 'Shopify store'} />
          <Fact label="Created" value={formatDate(shop.createdAt)} />
          <Fact label="Verified" value={shop.platform === 'SHOPIFY' ? 'By Shopify' : formatDate(shop.verifiedAt)} />
          <Fact label="Daily limit" value={`${shop.dailyTryOnCap} try-ons`} />
          <Fact label="Allowed websites" value={shop.allowedOrigins.length === 0 ? '–' : shop.allowedOrigins.map(origin => <div key={origin}>{origin}</div>)} />
        </dl>
        {setStatus.isError && <p role="alert" className="text-destructive text-xs">Could not change the shop. Please try again.</p>}
        {canChange && (
          <Button type="button" size="sm" className="w-fit" variant={suspended ? 'outline' : 'destructive'} disabled={setStatus.isPending} onClick={handleStatus}>
            {suspended ? 'Let back in' : 'Suspend shop'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminShopDetailPage({ shopId }: { shopId: string }) {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError } = useAdminShopDetail(shopId, days);

  return (
    <div className="min-h-screen">
      <PageHeaderWithAction
        title={data?.shop.name ?? 'Shop'}
        description="Details, credits and history for one shop"
        actions={
          <Link href="/app/admin/shops" className="text-primary pr-4 text-xs underline">
            All shops
          </Link>
        }
      />
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 max-sm:p-3">
        {isLoading && <Skeleton className="h-64 rounded-lg" />}
        {isError && <p role="alert" className="text-destructive text-xs">Could not load this shop. It may not exist.</p>}
        {data && (
          <>
            <Details detail={data} />
            <AdminCreditsCard shopId={shopId} shopName={data.shop.name} credits={data.owner.credits} />
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
                <UsageDetails usage={data.usage} />
              </CardContent>
            </Card>
            <AdminAuditCard audit={data.audit} />
          </>
        )}
      </div>
    </div>
  );
}
