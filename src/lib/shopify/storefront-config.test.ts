import { storefrontMetafields } from './storefront-config';

const KEY = 'pk_live_0123456789abcdef0123456789abcdef';

describe('storefrontMetafields', () => {
  test('gives the extension the shop key and where to load the widget from', () => {
    const fields = storefrontMetafields(KEY, 'https://app.mirrae.test');

    expect(fields).toEqual([
      { namespace: 'mirrae', key: 'public_key', type: 'single_line_text_field', value: KEY },
      { namespace: 'mirrae', key: 'widget_url', type: 'single_line_text_field', value: 'https://app.mirrae.test/widget.js' },
    ]);
  });

  test('uses only the origin of the app address, whatever path or trailing slash it has', () => {
    const fields = storefrontMetafields(KEY, 'https://app.mirrae.test/shopify/');

    expect(fields?.find(field => field.key === 'widget_url')?.value).toBe('https://app.mirrae.test/widget.js');
  });

  test.each(['http://localhost:3000', 'http://app.mirrae.test', 'ftp://x.test', 'not a url', '', undefined])(
    'refuses %p: a store page is https, so an insecure or missing app address would never load (mixed content)',
    appUrl => {
      expect(storefrontMetafields(KEY, appUrl)).toBeNull();
    }
  );

  test.each(['', 'sk_live_secret', 'abc def', undefined])('refuses a value that is not a public shop key: %p', key => {
    expect(storefrontMetafields(key as string, 'https://app.mirrae.test')).toBeNull();
  });
});
