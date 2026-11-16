import { siteConfig } from '@/app/siteConfig';

// Origins allowed to call the API cross-origin: this app's own URL, plus local development.
export const ALLOWED_ORIGINS: readonly string[] = Array.from(
  new Set([new URL(siteConfig.url).origin, 'http://localhost:3000'])
);
