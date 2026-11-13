export type GarmentKind = 'dress' | 'blazer' | 'tee' | 'coat' | 'trousers' | 'skirt';
export type GarmentTone = 'gold-on-ink' | 'cream-on-ink' | 'ink-on-gold' | 'ink-on-paper';

type Props = {
  kind: GarmentKind;
  label: string;
  tone: GarmentTone;
  className?: string;
};

// Simple flat silhouettes drawn in a 120 x 150 box
const GARMENT_PATHS: Record<GarmentKind, string> = {
  dress: 'M46 12 L52 36 L38 54 L20 138 H100 L82 54 L68 36 L74 12 Q60 34 46 12Z',
  blazer:
    'M30 20 L52 14 L60 32 L68 14 L90 20 L106 62 L97 68 L90 52 V138 H30 V52 L23 68 L14 62Z',
  tee: 'M38 14 Q60 32 82 14 L108 34 L97 54 L84 45 V130 H36 V45 L23 54 L12 34Z',
  coat: 'M32 14 L52 10 L60 26 L68 10 L88 14 L102 72 L93 76 L90 50 V144 H30 V50 L27 76 L18 72Z',
  trousers: 'M34 14 H86 L93 138 H66 L60 62 L54 138 H27Z',
  skirt: 'M38 22 H82 L106 122 H14Z',
};

const TONES: Record<GarmentTone, { card: string; fill: string; line: string; label: string }> = {
  'gold-on-ink': {
    card: 'from-[#2B2420] to-[#14100E]',
    fill: '#E0B35F',
    line: '#14100E',
    label: 'text-white/70',
  },
  'cream-on-ink': {
    card: 'from-[#26211E] to-[#0F0C0B]',
    fill: '#F4EFE6',
    line: '#26211E',
    label: 'text-white/70',
  },
  'ink-on-gold': {
    card: 'from-[#F0CB85] to-[#C99A45]',
    fill: '#1C1917',
    line: '#E0B35F',
    label: 'text-mirrae-ink/70',
  },
  'ink-on-paper': {
    card: 'from-[#FAFAF9] to-[#E7E5E4]',
    fill: '#292524',
    line: '#FAFAF9',
    label: 'text-mirrae-ink/70',
  },
};

/** A tilted catalogue card holding a flat garment silhouette. Decorative. */
export function GarmentCard({ kind, label, tone, className = '' }: Props) {
  const palette = TONES[tone];

  return (
    <div
      className={`relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br shadow-[0_24px_50px_-18px_rgba(0,0,0,0.8)] ${palette.card} ${className}`}
    >
      <svg viewBox="0 0 120 150" className="absolute inset-0 h-full w-full p-3" focusable="false">
        <path d={GARMENT_PATHS[kind]} fill={palette.fill} />
        <path
          d="M60 30 V138"
          stroke={palette.line}
          strokeWidth="1.2"
          strokeDasharray="3 4"
          opacity="0.55"
        />
      </svg>
      <span
        className={`absolute bottom-3 left-3 text-[10px] font-semibold uppercase tracking-[0.18em] ${palette.label}`}
      >
        {label}
      </span>
    </div>
  );
}
