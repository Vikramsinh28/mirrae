import { ConfigError, readConfig } from './config';
import { mountWidget } from './ui';

/**
 * Entry point of the embeddable widget. A merchant adds one script tag:
 *   <script async src="https://<mirrae-host>/widget.js" data-shop-key="pk_live_..."></script>
 * See config.ts for the data-* options.
 */

declare global {
  interface Window {
    Mirrae?: { open: () => void; version: string };
    __mirraeWidgetLoaded?: boolean;
  }
}

const WIDGET_VERSION = '1';

function findOwnScript(): HTMLScriptElement | null {
  const current = document.currentScript;
  if (current instanceof HTMLScriptElement) return current;
  return document.querySelector<HTMLScriptElement>('script[data-shop-key]');
}

function start(script: HTMLScriptElement) {
  try {
    const config = readConfig(
      { src: script.src, dataset: { ...script.dataset } },
      { pageUrl: location.href, pageLang: document.documentElement.lang }
    );
    const { open } = mountWidget(config);
    window.Mirrae = { open, version: WIDGET_VERSION };
  } catch (error) {
    // Never break the merchant's page: report to the console and stay out of the way.
    const message = error instanceof ConfigError ? error.message : 'could not start';
    console.warn(`[Mirrae] ${message}`);
  }
}

(function main() {
  if (window.__mirraeWidgetLoaded) return;
  const script = findOwnScript();
  if (!script) return;
  window.__mirraeWidgetLoaded = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(script));
  else start(script);
})();
