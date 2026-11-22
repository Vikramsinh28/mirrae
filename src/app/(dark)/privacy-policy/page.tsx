import { Metadata } from 'next';

import { siteConfig } from '@/app/siteConfig';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { privacyPolicyMarkdown } from '@/data/legal/privacy-policy';

export const metadata: Metadata = {
  title: 'Privacy Policy - Mirrae',
  description:
    'How Mirrae handles shopper photos and merchant data: what we collect, who sees it, and how long we keep it.',
  openGraph: {
    title: 'Privacy Policy - Mirrae',
    description:
      'How Mirrae handles shopper photos and merchant data: what we collect, who sees it, and how long we keep it.',
    type: 'article',
    url: `${siteConfig.url}/privacy-policy`,
  },
  alternates: {
    canonical: `${siteConfig.url}/privacy-policy`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return <LegalDocument title="Privacy Policy" path="/privacy-policy" markdown={privacyPolicyMarkdown} />;
}
