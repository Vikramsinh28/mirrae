import type { Metadata } from 'next';

import { siteConfig } from '@/app/siteConfig';
import { Benefits } from '@/components/mirrae/benefits';
import { Faq } from '@/components/mirrae/faq';
import { FinalCta } from '@/components/mirrae/final-cta';
import { Hero } from '@/components/mirrae/hero';
import { HowItWorks } from '@/components/mirrae/how-it-works';
import { Marquee } from '@/components/mirrae/marquee';
import { Pricing } from '@/components/mirrae/pricing';
import { Privacy } from '@/components/mirrae/privacy';
import { Statement } from '@/components/mirrae/statement';
import { TryOnDemo } from '@/components/mirrae/try-on-demo';

export const metadata: Metadata = {
  alternates: { canonical: siteConfig.url },
  robots: { index: true, follow: true },
};

const RIBBON_ITEMS = [
  'Try it on',
  'See the fit',
  'About 30 seconds',
  'Pay per result',
  'Photos deleted after use',
] as const;

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
};

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
      <Marquee items={RIBBON_ITEMS} tilt={-2} />
      <TryOnDemo />
      <Statement />
      <HowItWorks />
      <Benefits />
      <Marquee items={RIBBON_ITEMS} tilt={1.5} reverse />
      <Privacy />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
