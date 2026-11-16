const BASE =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-forest';

/** Solid forest pill on paper. */
export const ctaSolid = `${BASE} bg-site-forest text-site-paper hover:bg-site-forest-deep`;

/** Outlined pill on paper. */
export const ctaOutline = `${BASE} border border-site-ink/30 text-site-ink hover:border-site-ink`;

/** Paper pill for the dark forest band. */
export const ctaOnForest = `${BASE} bg-site-paper text-site-forest-deep hover:bg-site-forest-soft focus-visible:outline-site-paper`;
