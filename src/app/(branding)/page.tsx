import type { Metadata } from 'next';

import { siteConfig } from '@/app/siteConfig';
import { Faq } from '@/components/marketing/faq';
import { FinalCta } from '@/components/marketing/final-cta';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { PricingTeaser } from '@/components/marketing/pricing-teaser';
import { RangeStrip } from '@/components/marketing/range-strip';
import { Trust } from '@/components/marketing/trust';
import { FAQS } from '@/data/mirrae-content';

export const metadata: Metadata = {
  alternates: { canonical: siteConfig.url },
  robots: { index: true, follow: true },
};

const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  },
];

// Statically generated: the landing page has no per-request data
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-authored JSON; no user input is interpolated
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <HowItWorks />
      <RangeStrip />
      <Trust />
      <PricingTeaser />
      <Faq />
      <FinalCta />
    </>
  );
}
