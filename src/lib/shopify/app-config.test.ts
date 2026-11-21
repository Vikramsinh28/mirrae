import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The Shopify CLI files cannot run in these tests, but their mistakes are easy to catch: the toml must subscribe to
 * exactly the topics the webhook route handles, and the theme block must be valid and only read settings it declares.
 */

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('shopify.app.toml', () => {
  const toml = read('shopify.app.toml');
  const route = read('src/app/api/shopify/webhooks/route.ts');

  const listAfter = (key: string): string[] =>
    [...toml.matchAll(new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`, 'gm'))].flatMap(match => [...match[1].matchAll(/"([^"]+)"/g)].map(topic => topic[1]));

  test('subscribes to the three mandatory privacy topics', () => {
    expect(listAfter('compliance_topics').sort()).toEqual(['customers/data_request', 'customers/redact', 'shop/redact']);
  });

  test('every topic it subscribes to is one the webhook route handles', () => {
    for (const topic of [...listAfter('topics'), ...listAfter('compliance_topics')]) {
      expect(route).toContain(`'${topic}'`);
    }
  });

  test('asks for no scopes, uses the same API version as the code, and is embedded', () => {
    expect(toml).toMatch(/scopes\s*=\s*""/);
    expect(toml).toMatch(/api_version\s*=\s*"2026-10"/);
    expect(toml).toMatch(/embedded\s*=\s*true/);
  });

  test('points the app at the embedded page and every webhook at the one route', () => {
    expect(toml).toMatch(/application_url\s*=\s*"https:\/\/[^"]+\/shopify"/);
    const uris = [...toml.matchAll(/uri\s*=\s*"([^"]+)"/g)].map(match => match[1]);
    expect(uris.length).toBeGreaterThan(0);
    uris.forEach(uri => expect(uri).toMatch(/^https:\/\/[^/]+\/api\/shopify\/webhooks$/));
  });
});

describe('theme app extension mirrae-tryon', () => {
  const liquid = read('extensions/mirrae-tryon/blocks/mirrae-tryon.liquid');
  const schemaText = /\{% schema %\}([\s\S]*?)\{% endschema %\}/.exec(liquid)?.[1] ?? '';
  const schema = JSON.parse(schemaText) as { name: string; target: string; settings: { id?: string; type: string }[] };
  const declared = schema.settings.flatMap(setting => (setting.id ? [setting.id] : []));

  test('is an app embed placed at the end of the page body', () => {
    expect(schema.target).toBe('body');
  });

  test('only reads block settings it declares', () => {
    const used = [...liquid.slice(0, liquid.indexOf('{% schema %}')).matchAll(/block\.settings\.(\w+)/g)].map(match => match[1]);
    expect(used.length).toBeGreaterThan(0);
    used.forEach(id => expect(declared).toContain(id));
  });

  test('passes the widget the same options its script tag reads', () => {
    const config = read('src/widget/config.ts');
    for (const attribute of ['data-shop-key', 'data-views', 'data-color', 'data-label', 'data-target']) {
      expect(liquid).toContain(attribute);
      expect(config).toContain(attribute.replace('data-', '').replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()).replace(/^/, 'dataset.'));
    }
  });

  test('reads the values the app stores (same namespace and keys as the storefront config)', () => {
    expect(liquid).toContain('app.metafields.mirrae.public_key');
    expect(liquid).toContain('app.metafields.mirrae.widget_url');
  });

  test('declares the handle the admin page links to', () => {
    expect(read('extensions/mirrae-tryon/shopify.extension.toml')).toContain('handle = "mirrae-tryon"');
  });

  test('escapes everything a merchant can type before it goes into the page', () => {
    for (const setting of ['label', 'target']) expect(liquid).toMatch(new RegExp(`block\\.settings\\.${setting} \\| escape`));
    expect(liquid).toMatch(/shop_key \| strip \| escape/);
  });
});
