'use client';

import { motion, type MotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Fragment, useRef } from 'react';

type Token = { text: string; isAccent?: boolean };

const TOKENS: readonly Token[] = [
  { text: 'Fit' },
  { text: 'is' },
  { text: 'personal.' },
  { text: 'So' },
  { text: 'we' },
  { text: 'let' },
  { text: 'every' },
  { text: 'shopper' },
  { text: 'see' },
  { text: 'it', isAccent: true },
  { text: 'on', isAccent: true },
  { text: 'themselves,', isAccent: true },
  { text: 'in' },
  { text: 'about' },
  { text: 'thirty' },
  { text: 'seconds,' },
  { text: 'before' },
  { text: 'checkout.' },
];

const DIM_OPACITY = 0.16;

type WordProps = {
  token: Token;
  progress: MotionValue<number>;
  range: [number, number];
  isStatic: boolean;
};

function Word({ token, progress, range, isStatic }: WordProps) {
  const opacity = useTransform(progress, range, [DIM_OPACITY, 1]);
  const accentClass = token.isAccent
    ? 'font-display text-[1.12em] font-medium normal-case italic tracking-tight text-mirrae-gold-soft'
    : '';

  return (
    <motion.span className={`inline-block ${accentClass}`} style={{ opacity: isStatic ? 1 : opacity }}>
      {token.text}
    </motion.span>
  );
}

/** Large statement whose words light up one by one as it scrolls through the viewport. */
export function Statement() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.55'],
  });

  return (
    <section
      id="idea"
      aria-labelledby="idea-heading"
      className="relative overflow-hidden bg-mirrae-ink px-6 py-28 text-white sm:py-40"
    >
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.22fr_1fr]">
        <p
          id="idea-heading"
          className="text-xs font-semibold uppercase tracking-[0.22em] text-mirrae-gold-soft"
        >
          The idea
        </p>
        <div
          ref={containerRef}
          className="font-impact text-[clamp(2rem,5.6vw,5rem)] font-bold uppercase leading-[1.05] tracking-[-0.02em]"
        >
          {TOKENS.map((token, index) => (
            <Fragment key={`${token.text}-${index}`}>
              <Word
                token={token}
                progress={scrollYProgress}
                range={[index / TOKENS.length, (index + 1) / TOKENS.length]}
                isStatic={reduceMotion}
              />{' '}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
