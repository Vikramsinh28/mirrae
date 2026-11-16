import { createShopSchema, updateShopSchema, usageQuerySchema } from './shop';

const parse = <T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: unknown } }, value: unknown) =>
  schema.safeParse(value);

describe('createShopSchema', () => {
  const valid = { name: 'My Store', domain: 'www.example.com' };

  test('accepts a name and a domain and fills in sensible website addresses', () => {
    const result = createShopSchema.parse(valid);

    expect(result.name).toBe('My Store');
    expect(result.domain).toBe('www.example.com');
    expect(result.allowedOrigins).toEqual(['https://www.example.com', 'https://example.com']);
    expect(result.imageHosts).toEqual([]);
  });

  test('a bare domain also gets its www address', () => {
    expect(createShopSchema.parse({ ...valid, domain: 'example.com' }).allowedOrigins).toEqual([
      'https://example.com',
      'https://www.example.com',
    ]);
  });

  test.each([
    ['a pasted https url', 'https://Shop.Example.com/products/shirt?x=1', 'shop.example.com'],
    ['capitals and spaces', '  WWW.Example.COM  ', 'www.example.com'],
    ['a trailing dot', 'example.com.', 'example.com'],
  ])('cleans up %s into a plain host name', (_name, input, expected) => {
    expect(createShopSchema.parse({ ...valid, domain: input }).domain).toBe(expected);
  });

  test.each([
    ['empty', ''],
    ['an IP address', '203.0.113.9'],
    ['no dot', 'intranet'],
    ['a space inside', 'my shop.com'],
    ['a javascript url', 'javascript:alert(1)'],
    ['an underscore', 'my_shop.example.com'],
    ['a path only', '/products'],
    ['over 253 characters', `${'a'.repeat(250)}.com`],
  ])('rejects a domain that is %s', (_name, domain) => {
    expect(parse(createShopSchema, { ...valid, domain }).success).toBe(false);
  });

  test('localhost is accepted outside production so merchants can test locally', () => {
    expect(createShopSchema.parse({ ...valid, domain: 'localhost' }).domain).toBe('localhost');
  });

  test.each(['', '   ', 'x'.repeat(81)])('rejects the name %p', name => {
    expect(parse(createShopSchema, { ...valid, name }).success).toBe(false);
  });

  test('trims the name', () => {
    expect(createShopSchema.parse({ ...valid, name: '  My Store  ' }).name).toBe('My Store');
  });
});

describe('updateShopSchema', () => {
  test('accepts one field at a time', () => {
    expect(updateShopSchema.parse({ name: 'New name' })).toEqual({ name: 'New name' });
    expect(updateShopSchema.parse({ dailyTryOnCap: 50 })).toEqual({ dailyTryOnCap: 50 });
    expect(updateShopSchema.parse({ status: 'PAUSED' })).toEqual({ status: 'PAUSED' });
  });

  test('refuses an empty update', () => {
    expect(parse(updateShopSchema, {}).success).toBe(false);
  });

  test.each(['SUSPENDED', 'UNINSTALLED', 'active', ''])('a merchant can only set ACTIVE or PAUSED, never %p', status => {
    expect(parse(updateShopSchema, { status }).success).toBe(false);
  });

  test.each([0, -5, 2.5, 2001, Number.NaN])('rejects the daily cap %p', dailyTryOnCap => {
    expect(parse(updateShopSchema, { dailyTryOnCap }).success).toBe(false);
  });

  describe('allowed websites', () => {
    test('are normalised to bare origins and de-duplicated', () => {
      const result = updateShopSchema.parse({
        allowedOrigins: ['https://Shop.Example.com/products/x', 'https://shop.example.com', 'https://other.example.com:443/'],
      });

      expect(result.allowedOrigins).toEqual(['https://shop.example.com', 'https://other.example.com']);
    });

    test('keeps a non-default port, which is part of an origin', () => {
      expect(updateShopSchema.parse({ allowedOrigins: ['https://shop.example.com:8443'] }).allowedOrigins).toEqual([
        'https://shop.example.com:8443',
      ]);
    });

    test.each([
      ['plain http for a real site', 'http://shop.example.com'],
      ['a wildcard', 'https://*.example.com'],
      ['a bare host with no scheme', 'shop.example.com'],
      ['a javascript url', 'javascript:alert(1)'],
      ['a data url', 'data:text/html,hi'],
      ['credentials in the url', 'https://user:pw@shop.example.com'],
      ['a lone asterisk', '*'],
    ])('rejects %s, so the key cannot be opened to every website', (_name, origin) => {
      expect(parse(updateShopSchema, { allowedOrigins: [origin] }).success).toBe(false);
    });

    test('allows http only for localhost (local testing)', () => {
      expect(updateShopSchema.parse({ allowedOrigins: ['http://localhost:3000'] }).allowedOrigins).toEqual(['http://localhost:3000']);
    });

    test('needs at least one and at most ten', () => {
      expect(parse(updateShopSchema, { allowedOrigins: [] }).success).toBe(false);
      const eleven = Array.from({ length: 11 }, (_, index) => `https://s${index}.example.com`);
      expect(parse(updateShopSchema, { allowedOrigins: eleven }).success).toBe(false);
    });
  });

  describe('image hosts', () => {
    test('are cleaned to host names and de-duplicated', () => {
      expect(updateShopSchema.parse({ imageHosts: ['https://CDN.shopify.com/s/files', 'cdn.shopify.com', 'images.example.com'] }).imageHosts).toEqual([
        'cdn.shopify.com',
        'images.example.com',
      ]);
    });

    test('may be empty (the shop domain is always allowed)', () => {
      expect(updateShopSchema.parse({ imageHosts: [] }).imageHosts).toEqual([]);
    });

    test.each(['169.254.169.254', '10.0.0.1', 'localhost', 'my host.com', 'javascript:x'])('rejects the host %p', host => {
      expect(parse(updateShopSchema, { imageHosts: [host] }).success).toBe(false);
    });

    test('at most ten', () => {
      const eleven = Array.from({ length: 11 }, (_, index) => `img${index}.example.com`);
      expect(parse(updateShopSchema, { imageHosts: eleven }).success).toBe(false);
    });
  });
});

describe('usageQuerySchema', () => {
  test('defaults to 30 days', () => {
    expect(usageQuerySchema.parse({}).days).toBe(30);
  });

  test.each([['7', 7], ['30', 30], ['90', 90]])('accepts %s days', (value, expected) => {
    expect(usageQuerySchema.parse({ days: value }).days).toBe(expected);
  });

  test.each(['0', '-1', '366', 'abc', '7.5'])('rejects %p days', days => {
    expect(parse(usageQuerySchema, { days }).success).toBe(false);
  });
});
