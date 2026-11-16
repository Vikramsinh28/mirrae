import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useApiMutation } from '@/hooks/useApiMutation';
import { adminApi, type AdminShopsQuery } from '@/services/api/admin';

const OVERVIEW_KEY = ['adminOverview'];
const SHOPS_KEY = ['adminShops'];

export function useAdminOverview(days: number) {
  return useQuery({ queryKey: [...OVERVIEW_KEY, days], queryFn: () => adminApi.overview(days) });
}

export function useAdminShops(query: AdminShopsQuery) {
  return useQuery({ queryKey: [...SHOPS_KEY, query], queryFn: () => adminApi.shops(query), placeholderData: keepPreviousData });
}

export function useSetShopStatus() {
  return useApiMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) => adminApi.setShopStatus(id, status),
    invalidateQueries: [SHOPS_KEY, OVERVIEW_KEY],
    showSuccessToast: false,
  });
}
