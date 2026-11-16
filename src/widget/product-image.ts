/**
 * Finds the product image on a product page, for storefronts where the merchant did not name one.
 * Order: the merchant's explicit image, the product structured data (JSON-LD), the Open Graph image,
 * then rel=image_src. Only https images are returned, because the server refuses anything else.
 */

export interface NodeLike {
  getAttribute(name: string): string | null;
  textContent?: string | null;
}

export interface PageLike {
  querySelector(selector: string): NodeLike | null;
  querySelectorAll(selector: string): ArrayLike<NodeLike>;
}

function toHttps(value: unknown, pageUrl: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), pageUrl);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

function isProduct(node: unknown): node is Record<string, unknown> {
  if (typeof node !== 'object' || node === null) return false;
  return asList((node as Record<string, unknown>)['@type']).includes('Product');
}

function* structuredNodes(value: unknown): Generator<unknown> {
  for (const node of asList(value)) {
    yield node;
    if (typeof node === 'object' && node !== null && '@graph' in node) {
      yield* structuredNodes((node as Record<string, unknown>)['@graph']);
    }
  }
}

function imageOf(product: Record<string, unknown>): unknown {
  const [first] = asList(product.image);
  if (typeof first === 'object' && first !== null) {
    const object = first as Record<string, unknown>;
    return object.url ?? object.contentUrl;
  }
  return first;
}

function fromStructuredData(doc: PageLike, pageUrl: string): string | null {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }
    for (const node of structuredNodes(data)) {
      if (!isProduct(node)) continue;
      const image = toHttps(imageOf(node), pageUrl);
      if (image) return image;
    }
  }
  return null;
}

export function findProductImage(doc: PageLike, pageUrl: string, explicit?: string): string | null {
  if (explicit) return toHttps(explicit, pageUrl);

  return (
    fromStructuredData(doc, pageUrl) ??
    toHttps(doc.querySelector('meta[property="og:image"]')?.getAttribute('content'), pageUrl) ??
    toHttps(doc.querySelector('link[rel="image_src"]')?.getAttribute('href'), pageUrl)
  );
}
