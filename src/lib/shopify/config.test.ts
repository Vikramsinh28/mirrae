import { readShopifyConfig } from './config';

describe('readShopifyConfig', () => {
  test('returns the credentials when both are set', () => {
    expect(readShopifyConfig({ SHOPIFY_API_KEY: ' id ', SHOPIFY_API_SECRET: 'secret' })).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });

  test.each([{}, { SHOPIFY_API_KEY: 'id' }, { SHOPIFY_API_SECRET: 'secret' }, { SHOPIFY_API_KEY: ' ', SHOPIFY_API_SECRET: 'secret' }])(
    'returns null when anything is missing or blank: %p',
    env => {
      expect(readShopifyConfig(env)).toBeNull();
    }
  );
});
