import Link from 'next/link';

import { siteConfig } from '@/app/siteConfig';
import { AuthCta } from '@/components/mirrae/auth-cta';
import { Rise } from '@/components/mirrae/rise';
import { BRAND_CATEGORIES, FREE_CREDITS_NOTE } from '@/data/marketing-content';

import { ctaOutline, ctaSolid } from './cta-styles';
import { HeroSlider } from './hero-slider';

const HERO_POINTS = [
  'Front, side and back views',
  'Photos deleted after use',
  'Works on any website',
] as const;

export function Hero() {
  return (
    <section id="home" aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-16 pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:pb-24 lg:pt-20">
        <div>
          <Rise>
            <p className="mb-6 text-xs font-medium uppercase tracking-[0.16em] text-site-forest">
              Virtual try-on for fashion e-commerce
            </p>
            <h1
              id="hero-heading"
              className="font-lux-display text-[clamp(3.2rem,8.5vw,6.4rem)] font-medium leading-[0.96] tracking-[-0.025em] text-balance"
            >
              Every shopper.
              <br />
              Every catalog.
              <br />
              <em className="font-normal text-site-forest">Everywhere.</em>
            </h1>
          </Rise>

          <Rise delay={0.1}>
            <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-site-ink-2 text-pretty">
              Mirrae lets your customers see any piece on themselves before they buy, from shirts and
              dresses to sarees and lehengas.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <AuthCta href={siteConfig.baseLinks.home} className={ctaSolid}>
                Start free
              </AuthCta>
              <Link href="/contact" className={ctaOutline}>
                Book a demo
              </Link>
            </div>
            <p className="mt-4 text-xs text-site-muted">{FREE_CREDITS_NOTE}</p>
            <ul className="mt-8 flex flex-wrap gap-x-7 gap-y-2.5 text-sm font-medium text-site-ink-2">
              {HERO_POINTS.map(point => (
                <li key={point} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-site-forest" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </Rise>
        </div>

        <Rise delay={0.18}>
          <HeroSlider />
        </Rise>
      </div>

      <div className="border-t border-site-rule">
        <p className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-5 text-[11.5px] font-medium uppercase tracking-[0.1em] text-site-muted">
          <span className="text-site-ink-2">Built for brands like yours</span>
          {BRAND_CATEGORIES.map(category => (
            <span key={category}>{category}</span>
          ))}
        </p>
      </div>
    </section>
  );
}
