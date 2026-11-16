import { adminShopsQuerySchema, adminShopStatusSchema, adminStatsQuerySchema } from './admin-shops';

describe('adminStatsQuerySchema', () => {
  test('defaults to 7 days and accepts a whole number up to 90', () => {
    expect(adminStatsQuerySchema.parse({}).days).toBe(7);
    expect(adminStatsQuerySchema.parse({ days: '30' }).days).toBe(30);
  });

  test.each(['0', '91', '-1', '1.5', 'abc', '7 OR 1=1'])('rejects %p', days => {
    expect(adminStatsQuerySchema.safeParse({ days }).success).toBe(false);
  });
});

describe('adminShopsQuerySchema', () => {
  test('has safe defaults when nothing is asked', () => {
    expect(adminShopsQuerySchema.parse({})).toEqual({ search: undefined, status: undefined, platform: undefined, limit: 25, offset: 0 });
  });

  test('treats empty filter values as no filter', () => {
    expect(adminShopsQuerySchema.parse({ search: '', status: '', platform: null })).toMatchObject({ search: undefined, status: undefined, platform: undefined });
  });

  test('trims the search text and keeps valid filters', () => {
    expect(adminShopsQuerySchema.parse({ search: '  store ', status: 'SUSPENDED', platform: 'SHOPIFY', limit: '50', offset: '25' })).toEqual({
      search: 'store',
      status: 'SUSPENDED',
      platform: 'SHOPIFY',
      limit: 50,
      offset: 25,
    });
  });

  test.each([{ status: 'DELETED' }, { platform: 'WOOCOMMERCE' }, { limit: '101' }, { limit: '0' }, { offset: '-5' }, { search: 'x'.repeat(101) }])('rejects %p', input => {
    expect(adminShopsQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe('adminShopStatusSchema', () => {
  test.each(['ACTIVE', 'SUSPENDED'])('lets an admin set %s', status => {
    expect(adminShopStatusSchema.safeParse({ status }).success).toBe(true);
  });

  test.each(['PAUSED', 'UNINSTALLED', 'DELETED', '', undefined])('does not let an admin set %p', status => {
    expect(adminShopStatusSchema.safeParse({ status }).success).toBe(false);
  });
});
