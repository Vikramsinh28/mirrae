import { Check } from 'lucide-react';

import { siteConfig } from '@/app/siteConfig';
import { AuthCta } from '@/components/mirrae/auth-cta';
import { Reveal } from '@/components/mirrae/reveal';
import { PRICING_POINTS } from '@/data/mirrae-content';

import { ctaOnForest } from './cta-styles';
import { SectionIntro } from './section-intro';

export function PricingTeaser() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-16 bg-site-forest-deep py-24 text-site-paper sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <SectionIntro
            id="pricing-heading"
            eyebrow="Pricing"
            onForest
            intro="No seats and no tiers to decode. You pay when a shopper gets a result."
          >
            Pay for results, <em className="text-site-forest-soft">not for promises.</em>
          </SectionIntro>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14 grid gap-10 border border-site-paper/25 p-8 sm:p-12 md:grid-cols-[auto_1fr] md:items-center">
            <div>
              <p className="font-lux-display text-8xl font-medium leading-none text-site-forest-soft">1</p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em]">credit per try-on</p>
            </div>
            <div>
              <ul className="space-y-3">
                {PRICING_POINTS.map(point => (
                  <li key={point} className="flex items-start gap-3 text-site-paper/90">
                    <Check size={20} className="mt-0.5 shrink-0 text-site-forest-soft" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <AuthCta href={siteConfig.baseLinks.home} className={ctaOnForest}>
                  Get started
                </AuthCta>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
