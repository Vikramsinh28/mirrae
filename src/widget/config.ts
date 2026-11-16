import { resolveLocale, type Locale } from './i18n';

/** Reads the merchant's settings from the script tag's data-* attributes, trusting none of them. */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface WidgetConfig {
  publicKey: string;
  apiBase: string;
  views: 'single' | 'multi';
  color: string;
  label?: string;
  /** CSS selector of the element the button is placed in; floating button when absent. */
  target?: string;
  productImage?: string;
  /** CSS selector of the store's own add-to-cart button; common ones (Shopify) are detected when absent. */
  cartButton?: string;
  locale: Locale;
}

export interface ScriptLike {
  src: string;
  dataset: Record<string, string | undefined>;
}

export interface PageInfo {
  pageUrl: string;
  pageLang?: string;
}

const DEFAULT_COLOR = '#111111';
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_LABEL_LENGTH = 40;
const PUBLIC_KEY_PREFIX = 'pk_';

function parseApiBase(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError('The widget API address is not a valid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ConfigError('The widget API address must be http or https');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function resolveUrl(value: string | undefined, pageUrl: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    return new URL(value.trim(), pageUrl).href;
  } catch {
    return undefined;
  }
}

function scriptOrigin(src: string): string {
  try {
    return new URL(src).origin;
  } catch {
    throw new ConfigError('Could not tell where the widget script was loaded from; set data-api');
  }
}

const clean = (value: string | undefined): string | undefined => value?.trim() || undefined;

export function readConfig(script: ScriptLike, { pageUrl, pageLang }: PageInfo): WidgetConfig {
  const { dataset } = script;

  const publicKey = clean(dataset.shopKey);
  if (!publicKey || !publicKey.startsWith(PUBLIC_KEY_PREFIX) || /\s/.test(publicKey)) {
    throw new ConfigError('data-shop-key must be your public key (it starts with pk_)');
  }

  const apiBase = parseApiBase(clean(dataset.api) ?? scriptOrigin(script.src));

  const color = clean(dataset.color);
  const label = clean(dataset.label)?.slice(0, MAX_LABEL_LENGTH);

  return {
    publicKey,
    apiBase,
    views: dataset.views === 'single' ? 'single' : 'multi',
    color: color && HEX_COLOR.test(color) ? color : DEFAULT_COLOR,
    label,
    target: clean(dataset.target),
    productImage: resolveUrl(dataset.productImage, pageUrl),
    cartButton: clean(dataset.cartButton),
    locale: resolveLocale(dataset.lang, pageLang),
  };
}
