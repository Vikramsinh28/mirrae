'use client';

import { Store } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useShops } from '@/hooks/useShops';
import type { ShopListItem } from '@/services/api/shops';

import { CreateShopDialog } from './CreateShopDialog';
import { ShopStatusBadge } from './ShopStatusBadge';

const SETUP_STEPS = [
  'Add your shop: its name and website address.',
  'Paste one line of code on your product pages.',
  'A "Try it on" button appears. Your shoppers can try clothes on themselves.',
];

function ShopCard({ shop }: { shop: ShopListItem }) {
  return (
    <Link href={`/app/shops/${shop.id}`} className="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-[3px]">
      <Card className="hover:bg-muted/40 h-full transition-colors">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="truncate text-sm">{shop.name}</CardTitle>
              <CardDescription className="truncate">{shop.domain}</CardDescription>
            </div>
            <ShopStatusBadge status={shop.status} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-text text-2xl font-semibold">{shop.tryOnsLast7Days}</p>
          <p className="text-text-muted text-xs">try-ons in the last 7 days</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ShopsPage() {
  const { data: shops, isLoading, isError } = useShops();
  const [creating, setCreating] = useState(false);

  return (
    <div className="min-h-screen">
      <PageHeaderWithAction title="Shops" description="Websites where shoppers can try clothes on" onAdd={() => setCreating(true)} addButtonText="Add shop" />

      <div className="p-4 max-sm:p-3">
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map(index => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {isError && <p role="alert" className="text-destructive text-sm">Could not load your shops. Please refresh the page.</p>}

        {shops && shops.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map(shop => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}

        {shops?.length === 0 && (
          <Card className="mx-auto max-w-lg">
            <CardHeader>
              <div className="bg-muted mb-2 grid size-9 place-items-center rounded-lg">
                <Store className="size-4" />
              </div>
              <CardTitle>Add your first shop</CardTitle>
              <CardDescription>It takes about two minutes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ol className="text-text list-decimal space-y-1.5 pl-5 text-xs">
                {SETUP_STEPS.map(step => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <button type="button" onClick={() => setCreating(true)} className="bg-primary text-primary-foreground hover:bg-primary/80 h-8 rounded-md px-3 text-xs font-medium">
                Add shop
              </button>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateShopDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
