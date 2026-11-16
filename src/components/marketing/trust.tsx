import { Reveal } from '@/components/mirrae/reveal';
import { PRIVACY_PROMISES } from '@/data/mirrae-content';

import { SectionIntro } from './section-intro';

export function Trust() {
  return (
    <section id="privacy" aria-labelledby="privacy-heading" className="scroll-mt-16 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <SectionIntro
            id="privacy-heading"
            eyebrow="Trust and privacy"
            intro="A photo of a person is personal. We treat it that way, and the product enforces it."
          >
            Their photo stays <em className="text-site-forest">theirs.</em>
          </SectionIntro>
        </Reveal>

        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {PRIVACY_PROMISES.map((promise, index) => (
            <Reveal key={promise.title} delay={index * 0.08}>
              <li className="h-full border border-site-rule bg-site-card p-8">
                <promise.icon className="text-site-forest" size={28} aria-hidden="true" />
                <h3 className="mt-6 text-xl font-semibold">{promise.title}</h3>
                <p className="mt-3 leading-relaxed text-site-ink-2">{promise.body}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
