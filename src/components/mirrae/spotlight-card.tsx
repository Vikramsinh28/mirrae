'use client';

import { type CSSProperties, type PointerEvent, type ReactNode, useRef } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Card with a gold glow that follows the cursor. Position is written straight to CSS variables. */
export function SpotlightCard({ children, className = '' }: Props) {
  const cardRef = useRef<HTMLLIElement>(null);

  const handlePointerMove = (event: PointerEvent<HTMLLIElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const { left, top } = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - left}px`);
    card.style.setProperty('--my', `${event.clientY - top}px`);
  };

  return (
    <li
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`group relative overflow-hidden ${className}`}
      style={{ '--mx': '50%', '--my': '50%' } as CSSProperties}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(360px circle at var(--mx) var(--my), rgba(224,179,95,0.18), transparent 65%)',
        }}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col justify-between">{children}</div>
    </li>
  );
}
