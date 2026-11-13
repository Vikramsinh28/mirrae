'use client';

import {
  motion,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { type CSSProperties, useEffect } from 'react';

import { GarmentCard, type GarmentKind, type GarmentTone } from './garment-card';

type Placement = {
  kind: GarmentKind;
  label: string;
  tone: GarmentTone;
  /** Position and responsive visibility classes. */
  position: string;
  /** Card width classes. */
  size: string;
  tilt: number;
  /** How far the card drifts with the cursor, in px. */
  depth: number;
  floatDelay: string;
};

const PLACEMENTS: readonly Placement[] = [
  { kind: 'dress', label: 'Silk dress', tone: 'gold-on-ink', position: 'left-[-6%] top-[2%] sm:left-[3%] sm:top-[12%]', size: 'w-24 sm:w-36 lg:w-44', tilt: -10, depth: 26, floatDelay: '0s' },
  { kind: 'blazer', label: 'Wool blazer', tone: 'ink-on-gold', position: 'right-[-6%] bottom-[3%] sm:bottom-auto sm:right-[3%] sm:top-[9%]', size: 'w-24 sm:w-36 lg:w-48', tilt: 8, depth: 34, floatDelay: '1.4s' },
  { kind: 'tee', label: 'Cotton tee', tone: 'cream-on-ink', position: 'left-[1%] bottom-[14%] hidden sm:block', size: 'w-32 lg:w-40', tilt: 7, depth: 20, floatDelay: '2.6s' },
  { kind: 'coat', label: 'Long coat', tone: 'ink-on-paper', position: 'right-[2%] bottom-[12%] hidden sm:block', size: 'w-32 lg:w-44', tilt: -7, depth: 30, floatDelay: '0.8s' },
  { kind: 'trousers', label: 'Trousers', tone: 'gold-on-ink', position: 'left-[19%] top-[3%] hidden lg:block', size: 'w-28', tilt: 12, depth: 14, floatDelay: '3.2s' },
  { kind: 'skirt', label: 'Pleat skirt', tone: 'cream-on-ink', position: 'right-[20%] bottom-[3%] hidden lg:block', size: 'w-28', tilt: -12, depth: 18, floatDelay: '2s' },
];

type ParallaxCardProps = {
  placement: Placement;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  isStatic: boolean;
};

function ParallaxCard({ placement, pointerX, pointerY, isStatic }: ParallaxCardProps) {
  const x = useTransform(pointerX, value => (isStatic ? 0 : value * placement.depth));
  const y = useTransform(pointerY, value => (isStatic ? 0 : value * placement.depth));
  const floatStyle = {
    '--tilt': `${placement.tilt}deg`,
    animationDelay: placement.floatDelay,
  } as CSSProperties;

  return (
    <motion.div className={`absolute ${placement.position} ${placement.size}`} style={{ x, y }}>
      <div className="mirrae-float" style={floatStyle}>
        <GarmentCard kind={placement.kind} label={placement.label} tone={placement.tone} />
      </div>
    </motion.div>
  );
}

/** Garment cards that drift gently and lean away from the cursor. Purely decorative. */
export function FloatingGarments() {
  const reduceMotion = useReducedMotion() ?? false;
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pointerX = useSpring(rawX, { stiffness: 60, damping: 18 });
  const pointerY = useSpring(rawY, { stiffness: 60, damping: 18 });

  useEffect(() => {
    if (reduceMotion) return;

    const handlePointerMove = (event: PointerEvent) => {
      rawX.set((event.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((event.clientY / window.innerHeight - 0.5) * 2);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [reduceMotion, rawX, rawY]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-45 sm:opacity-100" aria-hidden="true">
      {PLACEMENTS.map(placement => (
        <ParallaxCard
          key={placement.label}
          placement={placement}
          pointerX={pointerX}
          pointerY={pointerY}
          isStatic={reduceMotion}
        />
      ))}
    </div>
  );
}
