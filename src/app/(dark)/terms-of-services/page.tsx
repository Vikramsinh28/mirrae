import { Metadata } from 'next';

import { siteConfig } from '@/app/siteConfig';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { termsOfServiceMarkdown } from '@/data/legal/terms-of-service';

export const metadata: Metadata = {
  title: 'Terms of Service - Mirrae',
  description:
    'The terms for stores that install or use Mirrae virtual try-on: credits, billing, responsibilities and limits.',
  openGraph: {
    title: 'Terms of Service - Mirrae',
    description:
      'The terms for stores that install or use Mirrae virtual try-on: credits, billing, responsibilities and limits.',
    type: 'article',
    url: `${siteConfig.url}/terms-of-services`,
  },
  alternates: {
    canonical: `${siteConfig.url}/terms-of-services`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsofServicePage() {
  return <LegalDocument title="Terms of Service" path="/terms-of-services" markdown={termsOfServiceMarkdown} />;
}
