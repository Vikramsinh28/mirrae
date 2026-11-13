import Link from 'next/link';

import { siteConfig } from '@/app/siteConfig';

import { AuthCta } from './auth-cta';
import { ctaPrimary, ctaSecondary } from './button-styles';
import { Reveal } from './reveal';
import { Starfield } from './starfield';

const BIG_WORDS = 'Try it on · Try it on · Try it on · Try it on · ';

function BigWordsRow() {
  return (
    <span className="shrink-0 whitespace-pre pr-0 font-impact text-[clamp(5rem,17vw,15rem)] font-extrabold uppercase leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(224,179,95,0.5)]">
      {BIG_WORDS}
    </span>
  );
}

export function FinalCta() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="relative isolate scroll-mt-16 overflow-hidden bg-mirrae-ink pb-28 pt-20 text-white sm:pb-36 sm:pt-28"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(224,179,95,0.24),transparent)]"
        aria-hidden="true"
      />
      <Starfield count={40} />
      <div className="mirrae-grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="overflow-hidden" aria-hidden="true">
        <div className="mirrae-marquee-track flex w-max" style={{ animationDuration: '60s' }}>
          <BigWordsRow />
          <BigWordsRow />
        </div>
      </div>

      <Reveal className="relative mx-auto -mt-4 max-w-4xl px-6 text-center sm:-mt-10">
        <h2
          id="cta-heading"
          className="font-impact text-4xl font-extrabold uppercase leading-[0.98] tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl"
        >
          One photo. Thirty seconds.{' '}
          <em className="font-display text-[1.15em] font-medium normal-case tracking-tight text-mirrae-gold-soft">
            A confident yes.
          </em>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/75">
          Run a real try-on in the demo, or join the waitlist for the Shopify app.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <AuthCta href={siteConfig.baseLinks.try} className={ctaPrimary}>
            Try the demo
          </AuthCta>
          <Link href="/contact" className={ctaSecondary}>
            Join the waitlist
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
