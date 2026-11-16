import Link from 'next/link';

import { siteConfig } from '@/app/siteConfig';

import { AuthCta } from './auth-cta';
import { ctaPrimary, ctaSecondary } from './button-styles';
import { FloatingGarments } from './floating-garments';
import { Rise } from './rise';
import { Starfield } from './starfield';

const TRUST_POINTS = [
  'Shopify app coming soon',
  'Pay only for successful try-ons',
  'Photos deleted after processing',
] as const;

export function Hero() {
  return (
    <section
      id="home"
      className="relative isolate flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden bg-mirrae-ink text-white"
      aria-labelledby="hero-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_45%,rgba(224,179,95,0.16),transparent),radial-gradient(40%_40%_at_90%_100%,rgba(224,179,95,0.1),transparent)]"
        aria-hidden="true"
      />
      <Starfield />
      <FloatingGarments />
      <div className="mirrae-grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 text-center sm:py-28">
        <Rise>
          <p className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-mirrae-gold-soft backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-mirrae-gold-soft" aria-hidden="true" />
            Virtual try-on for fashion stores
          </p>
        </Rise>

        <Rise delay={0.08}>
          <h1
            id="hero-heading"
            className="font-impact text-[clamp(2.75rem,9.5vw,8.25rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.03em]"
          >
            Let them
            <span className="block font-display text-[1.18em] font-medium normal-case italic leading-[0.85] tracking-tight text-mirrae-gold-soft">
              wear it
            </span>
            before they buy.
          </h1>
        </Rise>

        <Rise delay={0.18}>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            {siteConfig.name} adds a “Try it on” button to your product pages. A shopper uploads one
            photo and, in about 30 seconds, sees themselves in the piece.
          </p>
        </Rise>

        <Rise delay={0.26}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <AuthCta href={siteConfig.baseLinks.try} className={ctaPrimary}>
              Try the demo
            </AuthCta>
            <Link href="/contact" className={ctaSecondary}>
              Join the waitlist
            </Link>
          </div>
        </Rise>

        <Rise delay={0.34}>
          <ul className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/65">
            {TRUST_POINTS.map(point => (
              <li key={point} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-mirrae-gold-soft" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </Rise>
      </div>

      <div
        className="absolute bottom-6 left-1/2 hidden h-12 w-px -translate-x-1/2 overflow-hidden bg-white/15 sm:block"
        aria-hidden="true"
      >
        <span className="mirrae-scroll-cue absolute inset-x-0 top-0 h-full bg-mirrae-gold-soft" />
      </div>
    </section>
  );
}
