import { useQuery } from '@tanstack/react-query';

import { useApiMutation } from '@/hooks/useApiMutation';
import { shopsApi, type CreateShopParams, type UpdateShopParams } from '@/services/api/shops';

const shopsKey = ['shops'];
const shopKey = (id: string) => ['shop', id];
const usageKey = (id: string, days: number) => ['shopUsage', id, String(days)];

export function useShops() {
  return useQuery({ queryKey: shopsKey, queryFn: shopsApi.list });
}

export function useSetupStatus() {
  return useQuery({ queryKey: ['shopSetup'], queryFn: shopsApi.setupStatus });
}

export function useShop(id: string) {
  return useQuery({ queryKey: shopKey(id), queryFn: () => shopsApi.get(id), enabled: !!id });
}

export function useShopUsage(id: string, days: number) {
  return useQuery({ queryKey: usageKey(id, days), queryFn: () => shopsApi.usage(id, days), enabled: !!id });
}

export function useCreateShop() {
  return useApiMutation({
    mutationFn: (params: CreateShopParams) => shopsApi.create(params),
    invalidateQueries: [shopsKey],
    successMessage: 'Shop added',
  });
}

export function useUpdateShop(id: string) {
  return useApiMutation({
    mutationFn: (params: UpdateShopParams) => shopsApi.update(id, params),
    invalidateQueries: [shopsKey, shopKey(id)],
    successMessage: 'Saved',
  });
}

export function useRotateShopKey(id: string) {
  return useApiMutation({
    mutationFn: () => shopsApi.rotateKey(id),
    invalidateQueries: [shopsKey, shopKey(id)],
    successMessage: 'New public key created. Update the snippet on your website.',
  });
}

export function useShopVerification(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['shopVerification', id], queryFn: () => shopsApi.verification(id), enabled: enabled && !!id });
}

export function useVerifyShop(id: string) {
  return useApiMutation<{ verified: true }, void>({
    mutationFn: () => shopsApi.verify(id),
    invalidateQueries: [shopsKey, shopKey(id), ['shopVerification', id]],
    successMessage: 'Website verified',
  });
}

export function useClaimInstructions(domain: string, enabled: boolean) {
  return useQuery({ queryKey: ['claimInstructions', domain], queryFn: () => shopsApi.claimInstructions(domain), enabled: enabled && !!domain });
}

export function useClaimDomain() {
  return useApiMutation({
    mutationFn: (params: CreateShopParams) => shopsApi.claim(params),
    invalidateQueries: [shopsKey],
    successMessage: 'Website claimed',
  });
}
