import { axios } from '@/lib/utils';

import type { ShopConversion, ShopStatus, ShopUsage } from './shops';

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
  verifiedAt: string | null;
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

export type AdminAction = 'SHOP_SUSPENDED' | 'SHOP_UNSUSPENDED' | 'CREDITS_GRANTED' | 'CREDITS_REMOVED';

export interface AdminAuditEntry {
  id: string;
  action: AdminAction;
  details: { shopName?: string; amount?: number; reason?: string; balanceAfter?: number; from?: string; to?: string };
  createdAt: string;
  adminEmail: string;
}

export interface AdminShopDetail {
  shop: {
    id: string;
    name: string;
    domain: string;
    platform: 'WEB' | 'SHOPIFY' | 'WOOCOMMERCE' | 'API';
    status: ShopStatus;
    dailyTryOnCap: number;
    createdAt: string;
    uninstalledAt: string | null;
    verifiedAt: string | null;
    allowedOrigins: string[];
  };
  owner: { email: string | null; credits: number };
  usage: ShopUsage;
  audit: AdminAuditEntry[];
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

  shopDetail: async (id: string, days: number): Promise<AdminShopDetail> => unwrap<AdminShopDetail>(await axios.get(`/admin/shops/${id}`, { params: { days } })),

  adjustCredits: async (id: string, input: { amount: number; reason: string }): Promise<{ balance: number }> =>
    unwrap<{ balance: number }>(await axios.post(`/admin/shops/${id}/credits`, input)),

  setShopStatus: async (id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<{ status: ShopStatus }> =>
    unwrap<{ status: ShopStatus }>(await axios.patch(`/admin/shops/${id}`, { status })),
};
