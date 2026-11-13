const BASE =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold tracking-wide transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2';

/** Gold pill for dark backgrounds. */
export const ctaPrimary = `${BASE} bg-mirrae-gold-soft text-mirrae-ink hover:bg-white focus-visible:outline-mirrae-gold-soft`;

/** Outlined pill for dark backgrounds. */
export const ctaSecondary = `${BASE} border border-white/30 text-white hover:border-white/70 hover:bg-white/5 focus-visible:outline-white`;

/** Solid ink pill for paper backgrounds. */
export const ctaOnPaper = `${BASE} bg-mirrae-ink text-white hover:bg-mirrae-stone focus-visible:outline-mirrae-ink`;
