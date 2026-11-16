import { findProductImage, type PageLike } from './product-image';

const PAGE = 'https://shop.example.com/products/blue-shirt';

interface FakeNode {
  attributes: Record<string, string>;
  text?: string;
}

function page(nodes: Record<string, FakeNode[]>): PageLike {
  const wrap = (node: FakeNode) => ({
    getAttribute: (name: string) => node.attributes[name] ?? null,
    textContent: node.text ?? null,
  });
  return {
    querySelector: selector => (nodes[selector]?.[0] ? wrap(nodes[selector][0]) : null),
    querySelectorAll: selector => (nodes[selector] ?? []).map(wrap),
  };
}

const ogImage = (content: string) => ({ 'meta[property="og:image"]': [{ attributes: { content } }] });
const jsonLd = (value: unknown) => ({ 'script[type="application/ld+json"]': [{ attributes: {}, text: JSON.stringify(value) }] });

describe('findProductImage', () => {
  test('uses the image the merchant named, before anything on the page', () => {
    const doc = page(ogImage('https://cdn.example.com/og.jpg'));

    expect(findProductImage(doc, PAGE, 'https://cdn.example.com/explicit.jpg')).toBe('https://cdn.example.com/explicit.jpg');
  });

  test('reads the Open Graph image', () => {
    expect(findProductImage(page(ogImage('https://cdn.example.com/og.jpg')), PAGE)).toBe('https://cdn.example.com/og.jpg');
  });

  test('resolves a relative or protocol-relative image against the page', () => {
    expect(findProductImage(page(ogImage('/img/shirt.jpg')), PAGE)).toBe('https://shop.example.com/img/shirt.jpg');
    expect(findProductImage(page(ogImage('//cdn.example.com/shirt.jpg')), PAGE)).toBe('https://cdn.example.com/shirt.jpg');
  });

  test.each([
    ['a string', { '@type': 'Product', image: 'https://cdn.example.com/ld.jpg' }],
    ['a list, taking the first', { '@type': 'Product', image: ['https://cdn.example.com/ld.jpg', 'https://cdn.example.com/2.jpg'] }],
    ['an ImageObject', { '@type': 'Product', image: { '@type': 'ImageObject', url: 'https://cdn.example.com/ld.jpg' } }],
    ['a graph', { '@graph': [{ '@type': 'WebPage' }, { '@type': 'Product', image: 'https://cdn.example.com/ld.jpg' }] }],
    ['a list of nodes', [{ '@type': 'BreadcrumbList' }, { '@type': 'Product', image: 'https://cdn.example.com/ld.jpg' }]],
  ])('reads the product structured data when the image is %s', (_name, data) => {
    expect(findProductImage(page(jsonLd(data)), PAGE)).toBe('https://cdn.example.com/ld.jpg');
  });

  test('prefers the product structured data over the Open Graph image (shops often use a banner there)', () => {
    const doc = page({ ...ogImage('https://cdn.example.com/banner.jpg'), ...jsonLd({ '@type': 'Product', image: 'https://cdn.example.com/product.jpg' }) });

    expect(findProductImage(doc, PAGE)).toBe('https://cdn.example.com/product.jpg');
  });

  test('ignores broken structured data and falls back', () => {
    const doc = page({
      ...ogImage('https://cdn.example.com/og.jpg'),
      'script[type="application/ld+json"]': [{ attributes: {}, text: '{not json' }],
    });

    expect(findProductImage(doc, PAGE)).toBe('https://cdn.example.com/og.jpg');
  });

  test('refuses anything that is not https, because the server would refuse it too', () => {
    expect(findProductImage(page(ogImage('http://cdn.example.com/a.jpg')), PAGE)).toBeNull();
    expect(findProductImage(page(ogImage('javascript:alert(1)')), PAGE)).toBeNull();
    expect(findProductImage(page(ogImage('data:image/png;base64,AAAA')), PAGE)).toBeNull();
  });

  test('returns null when the page names no image', () => {
    expect(findProductImage(page({}), PAGE)).toBeNull();
  });
});
