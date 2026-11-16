type Props = {
  variant: 'before' | 'after';
};

/**
 * Illustrated stand-in for a real try-on pair, until real before/after photos exist.
 * Both variants share the same body geometry so the slider aligns exactly.
 */
export function TryOnFigure({ variant }: Props) {
  const isAfter = variant === 'after';

  return (
    <svg
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`bg-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={isAfter ? '#2B2420' : '#E7E5E4'} />
          <stop offset="1" stopColor={isAfter ? '#14100E' : '#D6D3D1'} />
        </linearGradient>
        <radialGradient id={`glow-${variant}`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#E0B35F" stopOpacity={isAfter ? 0.35 : 0} />
          <stop offset="1" stopColor="#E0B35F" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="500" fill={`url(#bg-${variant})`} />
      <rect width="400" height="500" fill={`url(#glow-${variant})`} />
      <ellipse cx="200" cy="492" rx="150" ry="14" fill="#000" opacity="0.14" />

      {/* Neck and head */}
      <rect x="180" y="205" width="40" height="64" rx="18" fill="#C9A58B" />
      <ellipse cx="200" cy="158" rx="42" ry="52" fill="#D8B79E" />
      <path
        d="M156 152c-4-52 36-72 62-62 22 8 34 30 26 62-10-26-34-38-60-34-14 2-24 14-28 34Z"
        fill="#1C1917"
      />

      {isAfter ? <Blazer /> : <Tee />}
    </svg>
  );
}

function Tee() {
  return (
    <g>
      {/* Torso and short sleeves */}
      <path
        d="M64 500V396c0-48 34-88 92-104l44 22 44-22c58 16 92 56 92 104v104Z"
        fill="#A8A29E"
      />
      <path d="M64 396c-6 36-8 70-4 104h44V380Z" fill="#C9A58B" />
      <path d="M336 396c6 36 8 70 4 104h-44V380Z" fill="#C9A58B" />
      <path d="M64 396c0-30 10-58 30-78l22 24-10 62Z" fill="#A8A29E" />
      <path d="M336 396c0-30-10-58-30-78l-22 24 10 62Z" fill="#A8A29E" />
      {/* Neckline and a soft fold */}
      <path d="M168 296q32 36 64 0" fill="none" stroke="#78716C" strokeWidth="3" />
      <path d="M150 430q50 22 100 0" fill="none" stroke="#78716C" strokeWidth="2" opacity="0.5" />
    </g>
  );
}

function Blazer() {
  return (
    <g>
      {/* Torso and long sleeves */}
      <path
        d="M56 500V392c0-50 36-90 98-108l46 30 46-30c62 18 98 58 98 108v108Z"
        fill="#1C1917"
      />
      <path d="M56 392c-4 40-4 72 0 108h50V330Z" fill="#26211E" />
      <path d="M344 392c4 40 4 72 0 108h-50V330Z" fill="#26211E" />
      {/* Inner shirt */}
      <path d="M168 292l32 74 32-74-32 18Z" fill="#FAFAF9" />
      {/* Lapels */}
      <path d="M154 284l46 82-26 134h-34l-8-120c-2-40 6-72 22-96Z" fill="#2E2824" />
      <path d="M246 284l-46 82 26 134h34l8-120c2-40-6-72-22-96Z" fill="#2E2824" />
      <path d="M154 284l46 82" stroke="#E0B35F" strokeWidth="2" opacity="0.8" />
      <path d="M246 284l-46 82" stroke="#E0B35F" strokeWidth="2" opacity="0.8" />
      {/* Buttons and pocket square */}
      <circle cx="200" cy="420" r="5" fill="#E0B35F" />
      <circle cx="200" cy="456" r="5" fill="#E0B35F" />
      <path d="M262 392l28-6 4 20-30 4Z" fill="#E0B35F" />
    </g>
  );
}
