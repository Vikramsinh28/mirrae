import type { ReactNode } from 'react';

type Props = {
  id: string;
  eyebrow: string;
  children: ReactNode;
  intro?: string;
  /** Use on the dark forest band. */
  onForest?: boolean;
};

/** Eyebrow, serif heading and optional intro shared by the marketing sections. */
export function SectionIntro({ id, eyebrow, children, intro, onForest = false }: Props) {
  return (
    <div className="max-w-3xl">
      <p
        className={`mb-4 text-xs font-medium uppercase tracking-[0.16em] ${
          onForest ? 'text-site-forest-soft' : 'text-site-forest'
        }`}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className="font-lux-display text-5xl font-medium leading-[1] tracking-[-0.02em] text-balance sm:text-6xl [&_em]:font-normal"
      >
        {children}
      </h2>
      {intro && (
        <p
          className={`mt-5 text-lg leading-relaxed ${onForest ? 'text-site-paper/80' : 'text-site-ink-2'}`}
        >
          {intro}
        </p>
      )}
    </div>
  );
}
