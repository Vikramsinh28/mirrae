import { Reveal } from '@/components/mirrae/reveal';
import { MARKETING_STEPS } from '@/data/marketing-content';

import { SectionIntro } from './section-intro';

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-16 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <SectionIntro id="how-heading" eyebrow="How it works">
            Live in the time it takes to <em className="text-site-forest">paste a line.</em>
          </SectionIntro>
        </Reveal>

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {MARKETING_STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.08}>
              <li className="h-full border border-site-rule bg-site-card p-8">
                <span className="font-lux-display text-6xl font-medium leading-none text-site-forest">
                  {index + 1}
                </span>
                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-site-ink-2">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
