import Link from 'next/link';

import { siteConfig } from '@/app/siteConfig';
import { AuthCta } from '@/components/mirrae/auth-cta';
import { Reveal } from '@/components/mirrae/reveal';
import { FREE_CREDITS_NOTE } from '@/data/marketing-content';

import { ctaOutline, ctaSolid } from './cta-styles';

export function FinalCta() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="border-t border-site-rule bg-site-paper-2 py-24 text-center sm:py-32"
    >
      <Reveal className="mx-auto max-w-3xl px-6">
        <h2
          id="cta-heading"
          className="font-lux-display text-5xl font-medium leading-[1] tracking-[-0.02em] text-balance sm:text-7xl"
        >
          Let them wear it <em className="font-normal text-site-forest">before they buy.</em>
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
          <AuthCta href={siteConfig.baseLinks.home} className={ctaSolid}>
            Start free
          </AuthCta>
          <Link href="/contact" className={ctaOutline}>
            Book a demo
          </Link>
        </div>
        <p className="mt-4 text-xs text-site-muted">{FREE_CREDITS_NOTE}</p>
      </Reveal>
    </section>
  );
}
