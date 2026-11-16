import type { Metadata } from 'next';

import { EmbeddedAdminPage } from '@/components/organisms/modules/shopify/EmbeddedAdminPage';

export const metadata: Metadata = { title: 'Mirrae for Shopify', robots: { index: false, follow: false } };

// Read on the server on every request: the client id is public (Shopify shows it in the app page) but lives in the environment.
export const dynamic = 'force-dynamic';

export default function ShopifyAdminPage() {
  return <EmbeddedAdminPage apiKey={process.env.SHOPIFY_API_KEY?.trim() ?? ''} />;
}
