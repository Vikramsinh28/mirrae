import { axios } from '@/lib/utils';

export type ShopStatus = 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'UNINSTALLED';

export interface Shop {
  id: string;
  name: string;
  platform: 'WEB' | 'SHOPIFY' | 'WOOCOMMERCE' | 'API';
  domain: string;
  publicKey: string;
  allowedOrigins: string[];
  imageHosts: string[];
  status: ShopStatus;
  dailyTryOnCap: number;
  createdAt: string;
}

export interface ShopListItem extends Shop {
  tryOnsLast7Days: number;
}

export interface ShopConversion {
  opened: number;
  sawResult: number;
  addedToCart: number;
  shared: number;
  addToCartRate: number | null;
}

export interface ShopUsage {
  days: number;
  conversion: ShopConversion;
  jobs: { total: number; done: number; failed: number; inProgress: number };
  creditsSpent: number;
  failureReasons: { code: string; count: number }[];
  startedToday: number;
  dailyTryOnCap: number;
  recent: { id: string; status: string; viewCount: number; createdAt: string; charged: boolean; failureCode: string | null }[];
}

export interface CreateShopParams {
  name: string;
  domain: string;
}

export interface UpdateShopParams {
  name?: string;
  allowedOrigins?: string[];
  imageHosts?: string[];
  dailyTryOnCap?: number;
  status?: 'ACTIVE' | 'PAUSED';
}

const unwrap = <T>(response: { data?: { data?: T } }): T => {
  if (!response.data?.data) throw new Error('No Data was sent in Response');
  return response.data.data;
};

export const shopsApi = {
  list: async (): Promise<ShopListItem[]> => unwrap<{ shops: ShopListItem[] }>(await axios.get('/shops')).shops,

  get: async (id: string): Promise<Shop> => unwrap<{ shop: Shop }>(await axios.get(`/shops/${id}`)).shop,

  create: async (params: CreateShopParams): Promise<Shop> =>
    unwrap<{ shop: Shop }>(await axios.post('/shops', params)).shop,

  update: async (id: string, params: UpdateShopParams): Promise<Shop> =>
    unwrap<{ shop: Shop }>(await axios.patch(`/shops/${id}`, params)).shop,

  rotateKey: async (id: string): Promise<Shop> =>
    unwrap<{ shop: Shop }>(await axios.post(`/shops/${id}/rotate-key`)).shop,

  usage: async (id: string, days: number): Promise<ShopUsage> =>
    unwrap<{ usage: ShopUsage }>(await axios.get(`/shops/${id}/usage`, { params: { days } })).usage,
};
