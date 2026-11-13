type Props = {
  /** Number of dust specks per layer. */
  count?: number;
};

const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const LCG_MODULUS = 2 ** 32;

/** Deterministic pseudo-random sequence so server and client render identical markup. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
}

function buildShadows(count: number, seed: number, color: string): string {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const x = (random() * 100).toFixed(2);
    const y = (random() * 100).toFixed(2);
    return `${x}vw ${y}vh ${color}`;
  }).join(',');
}

/** Two twinkling layers of gold and white dust, drawn with a single box-shadow list each. */
export function Starfield({ count = 70 }: Props) {
  const goldDust = buildShadows(count, 7, 'rgba(224,179,95,0.9)');
  const whiteDust = buildShadows(Math.round(count * 0.8), 21, 'rgba(255,255,255,0.7)');

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span
        className="mirrae-twinkle absolute left-0 top-0 h-[2px] w-[2px] rounded-full"
        style={{ boxShadow: goldDust }}
      />
      <span
        className="mirrae-twinkle absolute left-0 top-0 h-px w-px rounded-full"
        style={{ boxShadow: whiteDust, animationDelay: '2.4s' }}
      />
    </div>
  );
}
