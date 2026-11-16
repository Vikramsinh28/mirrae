/**
 * Builds the script tag a merchant pastes into their website. Mirrors what the widget reads in
 * src/widget/config.ts (data-* options), leaving out anything that is just the default.
 */

export type SnippetLanguage = 'auto' | 'en' | 'hi' | 'ar';

export interface SnippetOptions {
  appUrl: string;
  publicKey: string;
  lang?: SnippetLanguage;
  color?: string;
  label?: string;
  views?: 'single' | 'multi';
  target?: string;
  productImage?: string;
}

const DEFAULT_COLOR = '#111111';
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const LANGUAGES: readonly string[] = ['en', 'hi', 'ar'];
const MAX_LABEL_LENGTH = 40;

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildInstallSnippet({ appUrl, publicKey, lang, color, label, views, target, productImage }: SnippetOptions): string {
  const options: [string, string][] = [['data-shop-key', publicKey]];

  if (lang && LANGUAGES.includes(lang)) options.push(['data-lang', lang]);
  if (color && HEX_COLOR.test(color) && color.toLowerCase() !== DEFAULT_COLOR) options.push(['data-color', color]);
  if (label?.trim()) options.push(['data-label', label.trim().slice(0, MAX_LABEL_LENGTH)]);
  if (views === 'single') options.push(['data-views', 'single']);
  if (target?.trim()) options.push(['data-target', target.trim()]);
  if (productImage?.trim()) options.push(['data-product-image', productImage.trim()]);

  const attributes = options.map(([name, value]) => `${name}="${escapeAttribute(value)}"`);
  const source = `src="${escapeAttribute(appUrl.replace(/\/+$/, ''))}/widget.js"`;

  return attributes.length === 1
    ? `<script async ${source} ${attributes[0]}></script>`
    : `<script async ${source}\n  ${attributes.join('\n  ')}></script>`;
}
