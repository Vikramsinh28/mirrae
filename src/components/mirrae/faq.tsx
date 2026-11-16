import { Plus } from 'lucide-react';

import { FAQS } from '@/data/mirrae-content';

import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-16 bg-mirrae-paper py-24 text-mirrae-ink sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <SectionHeading id="faq-heading" eyebrow="Questions" tone="paper">
          Things merchants <em className="italic text-mirrae-gold">ask first.</em>
        </SectionHeading>

        <Reveal delay={0.1}>
          <div className="divide-y divide-mirrae-line border-y border-mirrae-line">
            {FAQS.map(({ question, answer }) => (
              <details key={question} className="group py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-left font-display text-xl font-semibold marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mirrae-ink [&::-webkit-details-marker]:hidden">
                  {question}
                  <Plus
                    size={20}
                    className="shrink-0 text-mirrae-gold transition-transform duration-300 group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-5 pr-10 leading-relaxed text-mirrae-stone">{answer}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
