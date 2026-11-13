import { Check } from 'lucide-react';

import { siteConfig } from '@/app/siteConfig';
import { PRICING_POINTS } from '@/data/mirrae-content';

import { AuthCta } from './auth-cta';
import { ctaPrimary } from './button-styles';
import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="relative scroll-mt-16 overflow-hidden bg-mirrae-ink py-24 text-white sm:py-32"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[44rem] -translate-x-1/2 rounded-full bg-mirrae-gold-soft/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          id="pricing-heading"
          eyebrow="Pricing"
          tone="ink"
          align="center"
          intro="No seats, no tiers to decode. You pay when a shopper gets a result."
        >
          Pay for results, <em className="italic text-mirrae-gold-soft">not for promises.</em>
        </SectionHeading>

        <Reveal delay={0.1} className="mx-auto mt-14 max-w-3xl">
          <div className="grid gap-10 rounded-[2rem] border border-mirrae-gold-soft/30 bg-gradient-to-br from-mirrae-ink-raised to-mirrae-ink p-8 sm:p-12 md:grid-cols-[auto_1fr] md:items-center">
            <div className="text-center md:text-left">
              <p className="font-display text-7xl font-medium leading-none text-mirrae-gold-soft">1</p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
                credit per try-on
              </p>
            </div>

            <div>
              <ul className="space-y-3">
                {PRICING_POINTS.map(point => (
                  <li key={point} className="flex items-start gap-3 text-white/85">
                    <Check
                      size={20}
                      className="mt-0.5 shrink-0 text-mirrae-gold-soft"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <AuthCta href={siteConfig.baseLinks.try} className={ctaPrimary}>
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
