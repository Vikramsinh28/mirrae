'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useShopVerification, useVerifyShop } from '@/hooks/useShops';
import type { Shop } from '@/services/api/shops';

import { DnsRecordBox } from './DnsRecordBox';

/** Shown on a website shop until the merchant proves they own the website. Until then shoppers are not served. */
export function VerifyDomainCard({ shop }: { shop: Shop }) {
  const { data, isLoading, isError } = useShopVerification(shop.id, true);
  const verify = useVerifyShop(shop.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your website</CardTitle>
        <CardDescription>
          Prove that {shop.domain} is yours. Until you do, the try-on button will not work for your shoppers. This also stops anyone else from
          using your website name.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading && <Skeleton className="h-32 rounded-lg" />}
        {isError && <p role="alert" className="text-destructive text-xs">Could not load the steps. Please try again.</p>}
        {data && <DnsRecordBox record={data.record} />}
        {verify.isError && (
          <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
            We could not confirm the record yet. Check the name and value, wait a few minutes and try again.
          </p>
        )}
        <Button type="button" size="sm" className="w-fit" isLoading={verify.isPending} loadingText="Checking…" onClick={() => verify.mutate()} disabled={!data}>
          Check and verify
        </Button>
      </CardContent>
    </Card>
  );
}
