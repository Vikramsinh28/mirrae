import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { loadAppBridge } from '@/lib/shopify/app-bridge';
import { shopifyAdminApi } from '@/services/api/shopify-admin';

const overviewKey = (days: number) => ['shopifyOverview', days];

/** The embedded admin page's data: App Bridge first (it provides the session token), then the shop overview. */
export function useShopifyAdmin(apiKey: string, days: number) {
  const queryClient = useQueryClient();

  const bridge = useQuery({
    queryKey: ['appBridge', apiKey],
    queryFn: () => loadAppBridge(apiKey),
    staleTime: Infinity,
    retry: false,
  });
  const appBridge = bridge.data ?? null;
  const getToken = appBridge ? () => appBridge.idToken() : null;

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

  return { bridge, overview, setLive, embedded: bridge.isSuccess && bridge.data !== null };
}
