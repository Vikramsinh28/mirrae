import { STEPS } from '@/data/mirrae-content';

import { SectionHeading } from './section-heading';
import { StepVisual } from './step-visual';

const STICKY_TOP_PX = 88;
const STICKY_STEP_PX = 20;

export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="scroll-mt-16 bg-mirrae-paper py-24 text-mirrae-ink sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          tone="paper"
          intro="Three steps for the shopper. No app, no account, no measuring tape."
        >
          From one photo to <em className="text-mirrae-gold">“it looks great on me.”</em>
        </SectionHeading>

        {/* Cards pin to the top as you scroll and stack on top of each other */}
        <ol className="mt-16 space-y-8 sm:space-y-12">
          {STEPS.map(({ title, body, icon: Icon }, index) => (
            <li
              key={title}
              className="sticky grid gap-8 rounded-[2rem] border border-mirrae-line bg-white p-6 shadow-[0_30px_60px_-30px_rgba(28,25,23,0.35)] sm:p-10 md:grid-cols-[1.1fr_0.9fr] md:items-stretch"
              style={{ top: STICKY_TOP_PX + index * STICKY_STEP_PX }}
            >
              <div className="flex flex-col justify-between gap-8">
                <span
                  className="font-impact text-[clamp(5rem,12vw,9rem)] font-extrabold leading-[0.8] text-transparent [-webkit-text-stroke:2px_#a16207]"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-mirrae-ink text-mirrae-gold-soft">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="font-impact text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                    {title}
                  </h3>
                  <p className="mt-3 max-w-md leading-relaxed text-mirrae-stone">{body}</p>
                </div>
              </div>
              <StepVisual step={index} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
