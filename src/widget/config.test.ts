import { ConfigError, readConfig } from './config';

const SCRIPT_SRC = 'https://app.mirrae.test/widget.js';
const PAGE = 'https://shop.example.com/products/blue-shirt';

const read = (dataset: Record<string, string | undefined> = {}, src = SCRIPT_SRC, pageLang?: string) =>
  readConfig({ src, dataset: { shopKey: 'pk_live_abc', ...dataset } }, { pageUrl: PAGE, pageLang });

describe('readConfig', () => {
  test('reads the shop key and takes the API address from where the script was loaded', () => {
    const config = read();

    expect(config.publicKey).toBe('pk_live_abc');
    expect(config.apiBase).toBe('https://app.mirrae.test');
  });

  test('applies safe defaults: 3 views, a dark button, English', () => {
    const config = read();

    expect(config).toMatchObject({ views: 'multi', color: '#111111', locale: 'en', label: undefined, target: undefined });
  });

  test.each([undefined, '', '   ', 'sk_live_secret', 'abc'])('refuses a missing or wrong shop key %p (a secret key must never be embedded)', key => {
    expect(() => readConfig({ src: SCRIPT_SRC, dataset: { shopKey: key } }, { pageUrl: PAGE })).toThrow(ConfigError);
  });

  test('lets the merchant point at another API address, but only http(s)', () => {
    expect(read({ api: 'https://api.mirrae.test/' }).apiBase).toBe('https://api.mirrae.test');
    expect(() => read({ api: 'javascript:alert(1)' })).toThrow(ConfigError);
    expect(() => read({ api: 'ftp://x.test' })).toThrow(ConfigError);
  });

  test('accepts only a hex colour, so styling can never inject CSS', () => {
    expect(read({ color: '#0a7' }).color).toBe('#0a7');
    expect(read({ color: '#FFAA00' }).color).toBe('#FFAA00');
    expect(read({ color: 'red; background:url(//evil)' }).color).toBe('#111111');
    expect(read({ color: 'expression(alert(1))' }).color).toBe('#111111');
  });

  test('accepts only single or multi for the views, else the default', () => {
    expect(read({ views: 'single' }).views).toBe('single');
    expect(read({ views: 'multi' }).views).toBe('multi');
    expect(read({ views: 'ten' }).views).toBe('multi');
  });

  test('resolves a relative product image against the page and keeps an absolute one', () => {
    expect(read({ productImage: '/cdn/shirt.jpg' }).productImage).toBe('https://shop.example.com/cdn/shirt.jpg');
    expect(read({ productImage: 'https://cdn.shopify.com/a.png' }).productImage).toBe('https://cdn.shopify.com/a.png');
    expect(read({ productImage: 'http://' }).productImage).toBeUndefined();
  });

  test('picks the language from the page when the merchant did not choose one', () => {
    expect(read({}, SCRIPT_SRC, 'hi-IN').locale).toBe('hi');
    expect(read({ lang: 'ar' }, SCRIPT_SRC, 'hi-IN').locale).toBe('ar');
  });

  test('keeps the button label and placement selector the merchant chose', () => {
    const config = read({ label: 'Try on me', target: '#try-on-slot' });

    expect(config).toMatchObject({ label: 'Try on me', target: '#try-on-slot' });
  });

  test('cuts an overlong label instead of trusting it', () => {
    expect(read({ label: 'x'.repeat(200) }).label).toHaveLength(40);
  });

  test('refuses a script address that is not an http(s) url', () => {
    expect(() => readConfig({ src: '', dataset: { shopKey: 'pk_live_abc' } }, { pageUrl: PAGE })).toThrow(ConfigError);
  });
});
