'use client';

import { useDeferredValue, useState } from 'react';

import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminShops, useSetShopStatus } from '@/hooks/useAdminShops';
import type { AdminShop } from '@/services/api/admin';
import type { ShopStatus } from '@/services/api/shops';

import { ShopStatusBadge } from '../shops/ShopStatusBadge';

const PAGE_SIZE = 25;
const STATUSES: ShopStatus[] = ['ACTIVE', 'PAUSED', 'SUSPENDED', 'UNINSTALLED'];
const FIELD = 'border-input bg-background h-9 rounded-md border px-3 text-xs';

// Shopify shops get a made-up owner address; showing it would only confuse
const ownerLabel = (shop: AdminShop) => (shop.platform === 'SHOPIFY' ? 'Shopify store' : shop.owner.email);

function ShopRow({ shop, onChange, busy }: { shop: AdminShop; onChange: (id: string, status: 'ACTIVE' | 'SUSPENDED') => void; busy: boolean }) {
  const suspended = shop.status === 'SUSPENDED';
  const canChange = shop.status !== 'UNINSTALLED';

  const handleClick = () => {
    const question = suspended
      ? `Let ${shop.name} back in? Its shoppers will be served again.`
      : `Suspend ${shop.name}? Its shoppers will stop being served at once, and the merchant cannot undo this.`;
    if (window.confirm(question)) onChange(shop.id, suspended ? 'ACTIVE' : 'SUSPENDED');
  };

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{shop.name}</div>
        <div className="text-text-muted text-[11px]">{shop.domain}</div>
      </TableCell>
      <TableCell><Badge variant="default">{shop.platform === 'SHOPIFY' ? 'Shopify' : 'Website'}</Badge></TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <ShopStatusBadge status={shop.status} />
          {shop.platform === 'WEB' && shop.verifiedAt === null && <Badge variant="warning">Not verified</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-text-muted">{ownerLabel(shop)}</TableCell>
      <TableCell className="text-right">{shop.owner.credits.toFixed(1)}</TableCell>
      <TableCell className="text-right">{shop.tryOnsLast7Days}</TableCell>
      <TableCell className="text-right">
        {canChange && (
          <Button type="button" size="sm" variant={suspended ? 'outline' : 'destructive'} disabled={busy} onClick={handleClick}>
            {suspended ? 'Let back in' : 'Suspend'}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function AdminShopsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ShopStatus | ''>('');
  const [platform, setPlatform] = useState<'WEB' | 'SHOPIFY' | ''>('');
  const [offset, setOffset] = useState(0);
  const deferredSearch = useDeferredValue(search.trim());

  const { data, isLoading, isError, isFetching } = useAdminShops({
    search: deferredSearch || undefined,
    status: status || undefined,
    platform: platform || undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const setShopStatus = useSetShopStatus();

  // Any filter change goes back to the first page
  const onFilter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setOffset(0);
  };

  const total = data?.total ?? 0;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="min-h-screen">
      <PageHeaderWithAction title="All shops" description="Every merchant's shops. Suspending stops a shop's shoppers at once." />

      <div className="grid gap-4 p-4 max-sm:p-3">
        <div className="flex flex-wrap gap-2">
          <Input value={search} onChange={event => onFilter(setSearch)(event.target.value)} placeholder="Search shop, website or email" className="h-9 max-w-xs text-xs" aria-label="Search shops" />
          <select className={FIELD} value={status} onChange={event => onFilter(setStatus)(event.target.value as ShopStatus | '')} aria-label="Filter by status">
            <option value="">Any status</option>
            {STATUSES.map(option => (
              <option key={option} value={option}>{option.charAt(0) + option.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <select className={FIELD} value={platform} onChange={event => onFilter(setPlatform)(event.target.value as 'WEB' | 'SHOPIFY' | '')} aria-label="Filter by platform">
            <option value="">Any platform</option>
            <option value="WEB">Website</option>
            <option value="SHOPIFY">Shopify</option>
          </select>
        </div>

        {isLoading && <Skeleton className="h-48 rounded-lg" />}
        {isError && <p role="alert" className="text-destructive text-xs">Could not load shops. Please try again.</p>}
        {setShopStatus.isError && <p role="alert" className="text-destructive text-xs">Could not change that shop. Please try again.</p>}

        {data && (
          <>
            {data.shops.length === 0 ? (
              <p className="text-text-muted text-xs">No shops match.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Try-ons, 7 days</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.shops.map(shop => (
                    <ShopRow key={shop.id} shop={shop} busy={setShopStatus.isPending} onChange={(id, next) => setShopStatus.mutate({ id, status: next })} />
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="text-text-muted flex items-center justify-between text-xs">
              <span>{total === 0 ? 'No shops' : `${first}–${last} of ${total}`}{isFetching ? ' · updating…' : ''}</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                <Button type="button" size="sm" variant="outline" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
