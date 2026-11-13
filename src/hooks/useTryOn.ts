import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiMutation } from '@/hooks/useApiMutation';
import {
  createTryOn,
  getTryOnStatus,
  type CreateTryOnParams,
  type TryOnStatusResponse,
} from '@/services/api/tryon';

const POLL_INTERVAL_MS = 2_000;
// Past the 3-minute server stale window so getStatus can fail stuck jobs first.
const POLL_TIMEOUT_MS = 3 * 60 * 1000 + 15_000;
const POLL_TIMEOUT_ERROR = 'Try-on timed out. You have not been charged.';

export function useCreateTryOn() {
  return useApiMutation({
    mutationFn: (params: CreateTryOnParams) => createTryOn(params),
    invalidateQueries: [['credits']],
    showSuccessToast: false,
  });
}

export function useTryOnStatus(jobId: string | null) {
  const queryClient = useQueryClient();
  // Keyed to jobId so clearing/changing jobs does not need setState(false) in an effect.
  const [timedOutJobId, setTimedOutJobId] = useState<string | null>(null);
  const timedOut = timedOutJobId !== null && timedOutJobId === jobId;

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        // One last status read so failStaleJob can run before the UI gives up.
        try {
          await queryClient.fetchQuery({
            queryKey: ['tryOnStatus', jobId],
            queryFn: () => getTryOnStatus(jobId),
          });
        } catch {
          // Still surface a hard-cap failure below.
        }
        if (!cancelled) setTimedOutJobId(jobId);
      })();
    }, POLL_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, queryClient]);

  const query = useQuery({
    queryKey: ['tryOnStatus', jobId],
    queryFn: () => getTryOnStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query): number | false => {
      if (timedOut) return false;
      const status = query.state.data?.status;
      return status === 'done' || status === 'failed' ? false : POLL_INTERVAL_MS;
    },
    gcTime: 0,
  });

  const status = query.data?.status;
  if (timedOut && status !== 'done' && status !== 'failed') {
    const failed: TryOnStatusResponse = { status: 'failed', error: POLL_TIMEOUT_ERROR };
    return { ...query, data: failed };
  }

  return query;
}
