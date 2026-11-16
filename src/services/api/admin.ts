import { axios } from '@/lib/utils';

import type { ShopConversion, ShopStatus } from './shops';

/** Admin-only calls (the server refuses everyone else). */

export interface AdminOverview {
  days: number;
  merchants: number;
  newShops: number;
  shopsByStatus: Record<string, number>;
  shopsByPlatform: Record<string, number>;
  jobs: { total: number; done: number; failed: number; inProgress: number; successRate: number | null; startedToday: number };
  creditsSpent: number;
  failureReasons: { code: string; count: number }[];
  conversion: Omit<ShopConversion, 'addToCartRate'>;
  shopify: { liveCharges: number; liveRevenueUsd: number; testCharges: number };
  attention: {
    outOfCredits: { id: string; name: string; domain: string; platform: string; credits: number }[];
    highFailure: { id: string; name: string; domain: string; total: number; failed: number; failureRate: number }[];
  };
}

export interface AdminShop {
  id: string;
  name: string;
  domain: string;
  platform: 'WEB' | 'SHOPIFY' | 'WOOCOMMERCE' | 'API';
  status: ShopStatus;
  dailyTryOnCap: number;
  createdAt: string;
  uninstalledAt: string | null;
  owner: { email: string; credits: number };
  tryOnsLast7Days: number;
}

export interface AdminShopsQuery {
  search?: string;
  status?: ShopStatus;
  platform?: 'WEB' | 'SHOPIFY';
  limit: number;
  offset: number;
}

const unwrap = <T>(response: { data?: { data?: T } }): T => {
  if (!response.data?.data) throw new Error('No Data was sent in Response');
  return response.data.data;
};

export const adminApi = {
  overview: async (days: number): Promise<AdminOverview> =>
    unwrap<{ overview: AdminOverview }>(await axios.get('/admin/stats', { params: { days } })).overview,

  shops: async (query: AdminShopsQuery): Promise<{ total: number; shops: AdminShop[] }> =>
    unwrap<{ total: number; shops: AdminShop[] }>(await axios.get('/admin/shops', { params: query })),

  setShopStatus: async (id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<{ status: ShopStatus }> =>
    unwrap<{ status: ShopStatus }>(await axios.patch(`/admin/shops/${id}`, { status })),
};
