import { Sparkle } from 'lucide-react';

type Props = {
  items: readonly string[];
  /** Ribbon rotation in degrees. */
  tilt: number;
  reverse?: boolean;
};

function MarqueeRow({ items }: Pick<Props, 'items'>) {
  return (
    <ul className="flex shrink-0 items-center">
      {items.map(item => (
        <li
          key={item}
          className="flex items-center gap-6 px-6 font-impact text-sm font-bold uppercase tracking-[0.14em] sm:text-base"
        >
          {item}
          <Sparkle size={14} fill="currentColor" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}

/** A tilted gold ribbon of scrolling words that cuts across the boundary between sections. */
export function Marquee({ items, tilt, reverse = false }: Props) {
  return (
    <div className="relative z-20 -my-6 overflow-hidden py-6" aria-hidden="true">
      <div
        className="-mx-[5%] w-[110%] overflow-hidden bg-mirrae-gold-soft py-4 text-mirrae-ink shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]"
        style={{ transform: `rotate(${tilt}deg)` }}
      >
        <div
          className="mirrae-marquee-track flex w-max"
          style={{ animationDirection: reverse ? 'reverse' : 'normal' }}
        >
          <MarqueeRow items={items} />
          <MarqueeRow items={items} />
          <MarqueeRow items={items} />
          <MarqueeRow items={items} />
        </div>
      </div>
    </div>
  );
}
