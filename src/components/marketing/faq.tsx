import { Plus } from 'lucide-react';

import { Reveal } from '@/components/mirrae/reveal';
import { FAQS } from '@/data/mirrae-content';

import { SectionIntro } from './section-intro';

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16 py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[1fr_1.5fr]">
        <Reveal>
          <SectionIntro id="faq-heading" eyebrow="FAQ">
            Straight <em className="text-site-forest">answers.</em>
          </SectionIntro>
        </Reveal>

        <div className="border-t border-site-rule">
          {FAQS.map(item => (
            <details key={item.question} className="group border-b border-site-rule">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-forest [&::-webkit-details-marker]:hidden">
                {item.question}
                <Plus
                  size={20}
                  className="shrink-0 text-site-forest transition-transform duration-200 group-open:rotate-45"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-6 pr-10 leading-relaxed text-site-ink-2">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
