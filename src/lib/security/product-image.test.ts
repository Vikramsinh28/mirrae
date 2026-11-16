import { lookup } from 'node:dns/promises';

import { fetchProductImage, ProductImageError } from './product-image';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));

const lookupMock = lookup as unknown as jest.Mock;
const allowedHosts = ['cdn.shopify.com', 'shop.example.com'];
const URL_OK = 'https://cdn.shopify.com/s/files/1/product.jpg';

const publicAddress = [{ address: '93.184.216.34', family: 4 }];
const imageResponse = (bytes = [1, 2, 3], headers: Record<string, string> = { 'content-type': 'image/jpeg' }, status = 200) =>
  new Response(new Uint8Array(bytes), { status, headers });

describe('fetchProductImage', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    lookupMock.mockResolvedValue(publicAddress);
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => imageResponse());
  });

  afterEach(() => jest.restoreAllMocks());

  test('downloads an image from an allowed https host', async () => {
    const result = await fetchProductImage(URL_OK, { allowedHosts });

    expect(result.contentType).toBe('image/jpeg');
    expect(Array.from(result.bytes)).toEqual([1, 2, 3]);
  });

  test('never follows redirects, because a redirect could lead to an internal address', async () => {
    await fetchProductImage(URL_OK, { allowedHosts });

    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });

  test.each([
    ['plain http', 'http://cdn.shopify.com/a.jpg'],
    ['credentials in the url', 'https://user:pw@cdn.shopify.com/a.jpg'],
    ['a custom port', 'https://cdn.shopify.com:8443/a.jpg'],
    ['an IPv4 literal', 'https://127.0.0.1/a.jpg'],
    ['an IPv6 literal', 'https://[::1]/a.jpg'],
    ['a cloud metadata address', 'https://169.254.169.254/latest/meta-data'],
    ['a host that is not on the allowlist', 'https://evil.example.org/a.jpg'],
    ['a look-alike host that merely ends with the allowed name', 'https://fakecdn.shopify.com/a.jpg'],
    ['an allowed name used as a subdomain of another domain', 'https://cdn.shopify.com.attacker.net/a.jpg'],
    ['a non-url string', 'not a url'],
    ['a file url', 'file:///etc/passwd'],
  ])('refuses %s without making any request', async (_name, url) => {
    await expect(fetchProductImage(url, { allowedHosts })).rejects.toBeInstanceOf(ProductImageError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('allows a subdomain of an allowed host', async () => {
    await expect(fetchProductImage('https://img.shop.example.com/a.jpg', { allowedHosts })).resolves.toBeDefined();
  });

  test.each([
    ['private 10.x', [{ address: '10.0.0.5', family: 4 }]],
    ['loopback', [{ address: '127.0.0.1', family: 4 }]],
    ['link-local metadata', [{ address: '169.254.169.254', family: 4 }]],
    ['private 192.168.x', [{ address: '192.168.1.10', family: 4 }]],
    ['carrier-grade NAT', [{ address: '100.64.0.1', family: 4 }]],
    ['IPv6 loopback', [{ address: '::1', family: 6 }]],
    ['IPv6 unique-local', [{ address: 'fd12:3456::1', family: 6 }]],
    ['IPv4-mapped private IPv6', [{ address: '::ffff:10.0.0.1', family: 6 }]],
    ['one public and one private address', [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]],
  ])('refuses an allowed host that resolves to %s (DNS pointing inside)', async (_name, addresses) => {
    lookupMock.mockResolvedValue(addresses);

    await expect(fetchProductImage(URL_OK, { allowedHosts })).rejects.toBeInstanceOf(ProductImageError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('refuses a host that does not resolve', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(fetchProductImage(URL_OK, { allowedHosts })).rejects.toBeInstanceOf(ProductImageError);
  });

  test('refuses a redirect (fetch rejects) with a generic error', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));
    await expect(fetchProductImage(URL_OK, { allowedHosts })).rejects.toBeInstanceOf(ProductImageError);
  });

  test('refuses a non-200 answer', async () => {
    fetchSpy.mockImplementation(async () => imageResponse([1], { 'content-type': 'image/jpeg' }, 404));
    await expect(fetchProductImage(URL_OK, { allowedHosts })).rejects.toBeInstanceOf(ProductImageError);
  });

  test.each(['text/html', 'application/json', 'image/svg+xml', ''])('refuses the content type %p', async contentType => {
    fetchSpy.mockImplementation(async () => imageResponse([1, 2, 3], { 'content-type': contentType }));
    await expect(fetchProductImage(URL_OK, { allowedHosts })).rejects.toBeInstanceOf(ProductImageError);
  });

  test.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', async contentType => {
    fetchSpy.mockImplementation(async () => imageResponse([1, 2, 3], { 'content-type': contentType }));
    await expect(fetchProductImage(URL_OK, { allowedHosts })).resolves.toMatchObject({ contentType });
  });

  test('refuses an image whose declared length is over the limit before reading it', async () => {
    fetchSpy.mockImplementation(async () =>
      imageResponse([1], { 'content-type': 'image/jpeg', 'content-length': String(50 * 1024 * 1024) })
    );
    await expect(fetchProductImage(URL_OK, { allowedHosts, maxBytes: 1024 })).rejects.toBeInstanceOf(ProductImageError);
  });

  test('refuses a body that grows past the limit even when it lies about its length', async () => {
    fetchSpy.mockImplementation(async () => imageResponse(new Array(2048).fill(7)));
    await expect(fetchProductImage(URL_OK, { allowedHosts, maxBytes: 1024 })).rejects.toBeInstanceOf(ProductImageError);
  });

  test('refuses an empty body', async () => {
    fetchSpy.mockImplementation(async () => imageResponse([]));
    await expect(fetchProductImage(URL_OK, { allowedHosts })).rejects.toBeInstanceOf(ProductImageError);
  });
});
