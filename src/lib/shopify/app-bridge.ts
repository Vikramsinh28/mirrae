/**
 * Loads Shopify App Bridge in the embedded page. It reads the app's client id from a <meta name="shopify-api-key">
 * tag when it runs, so the tag goes in first; the script must also run in order, not async. App Bridge gives the
 * page a fresh session token (shopify.idToken()) to send to our API; the token is never stored.
 */

export interface AppBridge {
  idToken(): Promise<string>;
}

declare global {
  interface Window {
    shopify?: AppBridge;
  }
}

const APP_BRIDGE_SRC = 'https://cdn.shopify.com/shopifycloud/app-bridge.js';
const LOAD_TIMEOUT_MS = 10_000;

/** True when the page runs inside another page (the Shopify admin). Opened directly in a tab there is no token to get. */
export const isEmbedded = (): boolean => typeof window !== 'undefined' && window.top !== window.self;

export function loadAppBridge(apiKey: string): Promise<AppBridge | null> {
  if (!isEmbedded() || !apiKey) return Promise.resolve(null);
  if (window.shopify) return Promise.resolve(window.shopify);

  return new Promise((resolve, reject) => {
    const meta = document.createElement('meta');
    meta.name = 'shopify-api-key';
    meta.content = apiKey;
    document.head.prepend(meta);

    const script = document.createElement('script');
    script.src = APP_BRIDGE_SRC;
    script.async = false;
    const timer = setTimeout(() => reject(new Error('Shopify App Bridge did not load')), LOAD_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timer);
      if (window.shopify) resolve(window.shopify);
      else reject(new Error('Shopify App Bridge did not start'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Shopify App Bridge could not be loaded'));
    };
    document.head.prepend(script);
  });
}
