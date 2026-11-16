import { CREDIT_PACKS, findPack, isBillingTest, purchaseStatusFromShopify, returnUrlFor, safeConfirmationUrl } from './billing';

describe('credit packs', () => {
  test('every pack has a unique id, positive credits and a positive price', () => {
    const ids = CREDIT_PACKS.map(pack => pack.id);

    expect(new Set(ids).size).toBe(ids.length);
    CREDIT_PACKS.forEach(pack => {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.priceUsd).toBeGreaterThan(0);
    });
  });

  test('bigger packs never cost more per credit than smaller ones', () => {
    const perCredit = CREDIT_PACKS.map(pack => pack.priceUsd / pack.credits);

    perCredit.slice(1).forEach((price, index) => expect(price).toBeLessThanOrEqual(perCredit[index]));
  });

  test('findPack answers only for a known pack id (the client never names a price)', () => {
    expect(findPack(CREDIT_PACKS[0].id)).toBe(CREDIT_PACKS[0]);
    expect(findPack('pack_free_1000')).toBeNull();
    expect(findPack('')).toBeNull();
    expect(findPack('__proto__')).toBeNull();
  });
});

describe('isBillingTest', () => {
  test('is a test charge unless billing is explicitly switched to live', () => {
    expect(isBillingTest({})).toBe(true);
    expect(isBillingTest({ SHOPIFY_BILLING_LIVE: 'false' })).toBe(true);
    expect(isBillingTest({ SHOPIFY_BILLING_LIVE: 'TRUE ' })).toBe(true);
    expect(isBillingTest({ SHOPIFY_BILLING_LIVE: 'true' })).toBe(false);
  });
});

describe('purchaseStatusFromShopify', () => {
  test.each([
    ['ACTIVE', 'ACTIVE'],
    ['active', 'ACTIVE'],
    ['PENDING', 'PENDING'],
    ['DECLINED', 'DECLINED'],
    ['EXPIRED', 'EXPIRED'],
  ])('maps %p to %p', (input, expected) => {
    expect(purchaseStatusFromShopify(input)).toBe(expected);
  });

  test.each(['ACCEPTED', 'FROZEN', '', null, undefined, 5])('does not guess for %p: unknown statuses never pay out credits', input => {
    expect(purchaseStatusFromShopify(input)).toBeNull();
  });
});

describe('returnUrlFor', () => {
  test("sends the merchant back to the app inside their own Shopify admin", () => {
    expect(returnUrlFor('my-store.myshopify.com', 'client-123')).toBe('https://my-store.myshopify.com/admin/apps/client-123');
  });
});

describe('safeConfirmationUrl', () => {
  const shop = 'my-store.myshopify.com';

  test.each([
    `https://${shop}/admin/charges/1/confirm_recurring_application_charge`,
    'https://admin.shopify.com/store/my-store/charges/1/confirm',
  ])('accepts a Shopify admin address: %s', url => {
    expect(safeConfirmationUrl(url, shop)).toBe(url);
  });

  test.each([
    'http://my-store.myshopify.com/admin/x',
    'https://evil.com/admin/x',
    'https://my-store.myshopify.com.evil.com/x',
    'https://other-store.myshopify.com/admin/x',
    'javascript:alert(1)',
    'not a url',
    '',
    null,
    undefined,
  ])('refuses %p (the merchant is sent to this address)', url => {
    expect(safeConfirmationUrl(url, shop)).toBeNull();
  });
});
