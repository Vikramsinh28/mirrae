import Link from 'next/link';

import { PRIVACY_PROMISES } from '@/data/mirrae-content';

import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';

export function Privacy() {
  return (
    <section
      id="privacy"
      aria-labelledby="privacy-heading"
      className="scroll-mt-16 bg-mirrae-paper py-24 text-mirrae-ink sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <SectionHeading
            id="privacy-heading"
            eyebrow="Trust"
            tone="paper"
            intro="A photo of someone’s body is personal. Mirrae is built so shoppers stay in control of it."
          >
            Private by design, <em className="italic text-mirrae-gold">not by promise.</em>
          </SectionHeading>
          <Reveal delay={0.1}>
            <Link
              href="/privacy-policy"
              className="mt-8 inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-mirrae-ink underline decoration-mirrae-gold decoration-2 underline-offset-8 transition-colors duration-200 hover:text-mirrae-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mirrae-ink"
            >
              Read the privacy policy
            </Link>
          </Reveal>
        </div>

        <ul className="space-y-4">
          {PRIVACY_PROMISES.map(({ title, body, icon: Icon }, index) => (
            <Reveal key={title} delay={index * 0.1}>
              <li className="flex gap-5 rounded-3xl border border-mirrae-line bg-white p-7">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mirrae-ink text-mirrae-gold-soft">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-2xl font-semibold leading-tight">{title}</h3>
                  <p className="mt-2 leading-relaxed text-mirrae-stone">{body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
