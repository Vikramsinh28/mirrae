import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { loadAppBridge } from '@/lib/shopify/app-bridge';
import { shopifyAdminApi } from '@/services/api/shopify-admin';

const overviewKey = (days: number) => ['shopifyOverview', days];

/**
 * App Bridge on its own: it provides the session token. Cheap and shared (one cached query per api key), so it is
 * safe to call from several components; the data and the purchase sync live in useShopifyAdmin, which must be
 * called only once per page.
 */
export function useAppBridge(apiKey: string) {
  const bridge = useQuery({
    queryKey: ['appBridge', apiKey],
    queryFn: () => loadAppBridge(apiKey),
    staleTime: Infinity,
    retry: false,
  });
  return { bridge, embedded: bridge.isSuccess && bridge.data !== null };
}

/** The embedded admin page's data: the shop overview and the purchase sync. Call it ONCE, from the dashboard. */
export function useShopifyAdmin(apiKey: string, days: number) {
  const queryClient = useQueryClient();
  const { bridge, embedded } = useAppBridge(apiKey);

  const appBridge = bridge.data ?? null;
  const getToken = useMemo(() => (appBridge ? () => appBridge.idToken() : null), [appBridge]);

  const overview = useQuery({
    queryKey: overviewKey(days),
    queryFn: () => shopifyAdminApi.overview(getToken as () => Promise<string>, days),
    enabled: getToken !== null,
    retry: 1,
  });

  const setLive = useMutation({
    mutationFn: (status: 'ACTIVE' | 'PAUSED') => shopifyAdminApi.setLive(getToken as () => Promise<string>, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopifyOverview'] }),
  });

  // Settle any purchase approved since the last visit, once per page load, then refresh the balance. It waits for
  // the overview: on a first visit the overview call is what creates the shop, and the sync answers 404 before that.
  const [creditedNow, setCreditedNow] = useState(0);
  const synced = useRef(false);
  const shopLoaded = overview.isSuccess;
  useEffect(() => {
    if (!getToken || !shopLoaded || synced.current) return;
    synced.current = true;
    void shopifyAdminApi
      .syncPurchases(getToken)
      .then(({ credited }) => {
        if (credited > 0) {
          setCreditedNow(credited);
          void queryClient.invalidateQueries({ queryKey: ['shopifyOverview'] });
        }
      })
      // The sync is a courtesy on page load: the shop still works and the next visit tries again.
      .catch(() => undefined);
  }, [getToken, shopLoaded, queryClient]);

  // Opens Shopify's approval page in the top window (it cannot load inside this frame).
  const buy = useMutation({
    mutationFn: (packId: string) => shopifyAdminApi.purchase(getToken as () => Promise<string>, packId),
    onSuccess: ({ confirmationUrl }) => window.open(confirmationUrl, '_top'),
  });

  return { bridge, overview, setLive, buy, creditedNow, embedded };
}
