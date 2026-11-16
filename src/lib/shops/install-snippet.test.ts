import { buildInstallSnippet } from './install-snippet';

const base = { appUrl: 'https://app.mirrae.test', publicKey: 'pk_live_abc' };

describe('buildInstallSnippet', () => {
  test('is a single async script tag with only the shop key when nothing is customised', () => {
    expect(buildInstallSnippet(base)).toBe(
      '<script async src="https://app.mirrae.test/widget.js" data-shop-key="pk_live_abc"></script>'
    );
  });

  test('ignores a trailing slash on the app address', () => {
    expect(buildInstallSnippet({ ...base, appUrl: 'https://app.mirrae.test/' })).toContain('src="https://app.mirrae.test/widget.js"');
  });

  test('adds each chosen option on its own line', () => {
    const snippet = buildInstallSnippet({
      ...base,
      lang: 'hi',
      color: '#0a7e5c',
      label: 'Try on me',
      views: 'single',
      target: '#try-on-slot',
    });

    expect(snippet).toBe(
      [
        '<script async src="https://app.mirrae.test/widget.js"',
        '  data-shop-key="pk_live_abc"',
        '  data-lang="hi"',
        '  data-color="#0a7e5c"',
        '  data-label="Try on me"',
        '  data-views="single"',
        '  data-target="#try-on-slot"></script>',
      ].join('\n')
    );
  });

  test.each([
    ['automatic language', { lang: 'auto' as const }],
    ['the default 3 views', { views: 'multi' as const }],
    ['the default colour', { color: '#111111' }],
    ['an empty label', { label: '   ' }],
    ['an empty placement', { target: '' }],
    ['a colour that is not a hex code', { color: 'red' }],
    ['an unknown language', { lang: 'xx' as never }],
  ])('leaves out %s', (_name, options) => {
    expect(buildInstallSnippet({ ...base, ...options })).toBe(buildInstallSnippet(base));
  });

  test('makes text safe to paste into an HTML attribute, so a label can never break out of the tag', () => {
    const snippet = buildInstallSnippet({ ...base, label: 'Try "me" <on> & go' });

    expect(snippet).toContain('data-label="Try &quot;me&quot; &lt;on&gt; &amp; go"');
    expect(snippet.match(/<script/g)).toHaveLength(1);
    expect(snippet.match(/<\/script>/g)).toHaveLength(1);
  });

  test('cuts a very long label the way the widget does', () => {
    const snippet = buildInstallSnippet({ ...base, label: 'x'.repeat(100) });

    expect(snippet).toContain(`data-label="${'x'.repeat(40)}"`);
  });

  test('puts the product image in only when the merchant names one', () => {
    expect(buildInstallSnippet(base)).not.toContain('data-product-image');
    expect(buildInstallSnippet({ ...base, productImage: 'https://cdn.example.com/a.jpg' })).toContain(
      'data-product-image="https://cdn.example.com/a.jpg"'
    );
  });
});
