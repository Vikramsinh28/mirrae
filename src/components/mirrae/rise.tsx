import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

/**
 * Fade-up entrance driven by CSS only, so above-the-fold content paints immediately
 * instead of waiting for JavaScript to hydrate. Disabled for reduced-motion users in globals.css.
 */
export function Rise({ children, delay = 0, className = '' }: Props) {
  return (
    <div className={`mirrae-rise ${className}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}
