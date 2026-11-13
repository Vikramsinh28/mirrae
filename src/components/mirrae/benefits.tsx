import { BENEFITS } from '@/data/mirrae-content';

import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';
import { SpotlightCard } from './spotlight-card';
import { Starfield } from './starfield';

export function Benefits() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="relative isolate scroll-mt-16 overflow-hidden bg-mirrae-ink px-6 py-28 text-white sm:py-36"
    >
      <div
        className="pointer-events-none absolute -right-40 top-0 -z-10 h-[32rem] w-[32rem] rounded-full bg-mirrae-gold-soft/10 blur-3xl"
        aria-hidden="true"
      />
      <Starfield count={30} />

      <div className="relative mx-auto max-w-7xl">
        <SectionHeading
          id="features-heading"
          eyebrow="Why Mirrae"
          tone="ink"
          intro="Everything a fashion store needs to turn browsing into buying, and nothing it has to build."
        >
          Show the fit, <em className="text-mirrae-gold-soft">not just the photo.</em>
        </SectionHeading>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:auto-rows-fr lg:grid-cols-4">
          {BENEFITS.map(({ title, body, icon: Icon, span }, index) => {
            const isFeatured = index === 0;
            return (
              <Reveal key={title} delay={index * 0.07} className={`flex ${span}`}>
                <SpotlightCard
                  className={`w-full rounded-3xl border p-8 transition-colors duration-300 ${
                    isFeatured
                      ? 'border-mirrae-gold-soft/30 bg-gradient-to-br from-mirrae-ink-raised to-mirrae-ink hover:border-mirrae-gold-soft/60'
                      : 'border-white/10 bg-mirrae-ink-raised hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mirrae-gold-soft/10 text-mirrae-gold-soft">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span
                      className="font-impact text-5xl font-extrabold leading-none text-transparent [-webkit-text-stroke:1px_rgba(224,179,95,0.35)]"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="mt-12">
                    <h3
                      className={`font-impact font-bold leading-tight tracking-tight ${
                        isFeatured ? 'text-3xl sm:text-4xl' : 'text-xl'
                      }`}
                    >
                      {title}
                    </h3>
                    <p className="mt-3 leading-relaxed text-white/70">{body}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
