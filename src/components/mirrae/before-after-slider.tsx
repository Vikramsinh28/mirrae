'use client';

import { useInView, useReducedMotion } from 'framer-motion';
import { MoveHorizontal } from 'lucide-react';
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { TryOnFigure } from './try-on-figure';

const KEY_STEP = 5;
const PAGE_STEP = 20;
const SWEEP_POSITIONS = [78, 22, 50] as const;
const SWEEP_START_DELAY_MS = 700;
const SWEEP_STEP_MS = 1100;
const SMOOTH_MS = 800;

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/**
 * Drag-to-compare slider. The handle position is the share of the frame showing "before"
 * on the left; the remainder shows "after". Works with pointer, keyboard and buttons.
 */
export function BeforeAfterSlider() {
  const frameRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(frameRef, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();

  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isSmooth, setIsSmooth] = useState(false);

  // Intro sweep that teaches the interaction, skipped for reduced motion or once the user takes over
  useEffect(() => {
    if (!isInView || reduceMotion || hasInteracted) return;

    const timers = SWEEP_POSITIONS.map((target, index) =>
      window.setTimeout(() => {
        setIsSmooth(true);
        setPosition(target);
      }, SWEEP_START_DELAY_MS + index * SWEEP_STEP_MS)
    );
    const settle = window.setTimeout(
      () => setIsSmooth(false),
      SWEEP_START_DELAY_MS + SWEEP_POSITIONS.length * SWEEP_STEP_MS
    );

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(settle);
    };
  }, [isInView, reduceMotion, hasInteracted]);

  const moveTo = useCallback((next: number, smooth: boolean) => {
    setHasInteracted(true);
    setIsSmooth(smooth);
    setPosition(clamp(next));
  }, []);

  const moveToPointer = (clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const { left, width } = frame.getBoundingClientRect();
    if (width === 0) return;
    moveTo(((clientX - left) / width) * 100, false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    moveToPointer(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isDragging) moveToPointer(event.clientX);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const deltas: Record<string, number> = {
      ArrowLeft: -KEY_STEP,
      ArrowDown: -KEY_STEP,
      ArrowRight: KEY_STEP,
      ArrowUp: KEY_STEP,
      PageDown: -PAGE_STEP,
      PageUp: PAGE_STEP,
    };

    if (event.key === 'Home') moveTo(0, true);
    else if (event.key === 'End') moveTo(100, true);
    else if (event.key in deltas) moveTo(position + deltas[event.key], true);
    else return;

    event.preventDefault();
  };

  const transition = isSmooth && !isDragging ? `${SMOOTH_MS}ms cubic-bezier(0.22,1,0.36,1)` : 'none';
  const roundedPosition = Math.round(position);

  return (
    <div className="w-full">
      <div
        ref={frameRef}
        className="relative aspect-[4/5] w-full touch-pan-y select-none overflow-hidden rounded-[2rem] border border-white/10 bg-mirrae-ink-raised shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
      >
        <div className="absolute inset-0">
          <TryOnFigure variant="after" />
        </div>

        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 ${100 - position}% 0 0)`,
            transition: `clip-path ${transition}`,
          }}
        >
          <TryOnFigure variant="before" />
        </div>

        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-mirrae-ink/70 px-3 py-1 text-xs font-medium tracking-wide text-white backdrop-blur">
          Shopper photo
        </span>
        <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-mirrae-gold-soft px-3 py-1 text-xs font-semibold tracking-wide text-mirrae-ink">
          Try-on result
        </span>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare the shopper photo with the try-on result"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedPosition}
          aria-valuetext={`${roundedPosition}% shopper photo, ${100 - roundedPosition}% try-on result`}
          onKeyDown={handleKeyDown}
          className="group absolute inset-y-0 z-10 -ml-6 flex w-12 cursor-ew-resize items-center justify-center outline-none"
          style={{ left: `${position}%`, transition: `left ${transition}` }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/80" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-mirrae-ink/80 text-white shadow-lg backdrop-blur transition-transform duration-200 group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-mirrae-gold-soft group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-mirrae-ink">
            <MoveHorizontal size={20} aria-hidden="true" />
          </span>
        </div>

        <p
          className={`pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs font-medium tracking-wide text-white/90 transition-opacity duration-500 ${
            hasInteracted ? 'opacity-0' : 'opacity-100'
          }`}
        >
          Drag to compare
        </p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3" role="group" aria-label="Show">
        <button
          type="button"
          onClick={() => moveTo(100, true)}
          className="min-h-11 cursor-pointer rounded-full border border-white/25 px-5 text-sm font-medium text-white transition-colors duration-200 hover:border-white/60 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Before
        </button>
        <button
          type="button"
          onClick={() => moveTo(0, true)}
          className="min-h-11 cursor-pointer rounded-full bg-mirrae-gold-soft px-5 text-sm font-semibold text-mirrae-ink transition-colors duration-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mirrae-gold-soft"
        >
          After
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-white/60">
        Illustration. Real try-ons use your shopper’s photo and your product image.
      </p>
    </div>
  );
}
