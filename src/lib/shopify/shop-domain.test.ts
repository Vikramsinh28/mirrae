import { isMyshopifyDomain, normalizeMyshopifyDomain } from './shop-domain';

describe('normalizeMyshopifyDomain', () => {
  test.each([
    ['my-store.myshopify.com', 'my-store.myshopify.com'],
    ['My-Store.MyShopify.com', 'my-store.myshopify.com'],
    ['https://my-store.myshopify.com/', 'my-store.myshopify.com'],
    ['  my-store.myshopify.com  ', 'my-store.myshopify.com'],
  ])('accepts %p as %p', (input, expected) => {
    expect(normalizeMyshopifyDomain(input)).toBe(expected);
  });

  test.each([
    'evil.com',
    'my-store.myshopify.com.evil.com',
    'evil.com/my-store.myshopify.com',
    'my-store.myshopify.com@evil.com',
    'user:pass@my-store.myshopify.com',
    'my store.myshopify.com',
    '-bad.myshopify.com',
    '.myshopify.com',
    'myshopify.com',
    'sub.my-store.myshopify.com',
    '',
    null,
    undefined,
  ])('refuses %p (a shop value from a request must never point us at another host)', input => {
    expect(normalizeMyshopifyDomain(input)).toBeNull();
  });
});

describe('isMyshopifyDomain', () => {
  test('is true only for an exact myshopify.com store address', () => {
    expect(isMyshopifyDomain('my-store.myshopify.com')).toBe(true);
    expect(isMyshopifyDomain('www.example.com')).toBe(false);
  });
});
