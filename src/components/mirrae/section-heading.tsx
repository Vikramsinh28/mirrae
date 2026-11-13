import type { ReactNode } from 'react';

import { Reveal } from './reveal';

type Props = {
  id: string;
  eyebrow: string;
  children: ReactNode;
  /** Visual tone of the surrounding section. */
  tone: 'paper' | 'ink';
  intro?: string;
  align?: 'left' | 'center';
};

/** Eyebrow, serif heading and optional intro shared by every landing section. */
export function SectionHeading({ id, eyebrow, children, tone, intro, align = 'left' }: Props) {
  const isInk = tone === 'ink';
  const alignment = align === 'center' ? 'mx-auto text-center' : '';

  return (
    <Reveal className={`max-w-3xl ${alignment}`}>
      <p
        className={`mb-4 text-xs font-semibold uppercase tracking-[0.22em] ${
          isInk ? 'text-mirrae-gold-soft' : 'text-mirrae-gold'
        }`}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`font-impact text-4xl font-extrabold uppercase leading-[1] tracking-[-0.025em] text-balance sm:text-5xl lg:text-6xl [&_em]:font-display [&_em]:text-[1.15em] [&_em]:font-medium [&_em]:normal-case [&_em]:tracking-tight ${
          isInk ? 'text-white' : 'text-mirrae-ink'
        }`}
      >
        {children}
      </h2>
      {intro && (
        <p className={`mt-5 text-lg leading-relaxed ${isInk ? 'text-white/70' : 'text-mirrae-stone'}`}>
          {intro}
        </p>
      )}
    </Reveal>
  );
}
