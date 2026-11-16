import { adminCreditAdjustmentSchema, adminShopsQuerySchema, adminShopStatusSchema, adminStatsQuerySchema } from './admin-shops';

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

describe('adminCreditAdjustmentSchema', () => {
  test.each([50, -20, 0.5, 10000, -10000, 12.25])('accepts %p credits with a reason', amount => {
    expect(adminCreditAdjustmentSchema.safeParse({ amount, reason: 'Goodwill for a failed launch' }).success).toBe(true);
  });

  test.each([0, 10001, -10001, 1.005, Number.NaN, Infinity, -Infinity])('rejects the amount %p', amount => {
    expect(adminCreditAdjustmentSchema.safeParse({ amount, reason: 'a reason' }).success).toBe(false);
  });

  test.each(['10', null, undefined])('rejects an amount that is not a number: %p', amount => {
    expect(adminCreditAdjustmentSchema.safeParse({ amount, reason: 'a reason' }).success).toBe(false);
  });

  test.each(['', '  ', 'ok', undefined, 'x'.repeat(201)])('rejects a missing or unreasonable reason %p', reason => {
    expect(adminCreditAdjustmentSchema.safeParse({ amount: 5, reason }).success).toBe(false);
  });

  test('trims the reason', () => {
    expect(adminCreditAdjustmentSchema.parse({ amount: 5, reason: '  compensation  ' }).reason).toBe('compensation');
  });
});
