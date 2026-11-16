'use client';

import Image from 'next/image';
import { type ChangeEvent, useState } from 'react';

const START_POSITION = 52;
const MIN_POSITION = 4;
const MAX_POSITION = 96;

/** Drag-to-compare before/after built on a transparent range input, so keyboard and touch work natively. */
export function HeroSlider() {
  const [position, setPosition] = useState(START_POSITION);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    setPosition(Number(event.target.value));

  return (
    <div className="relative mx-auto w-full max-w-[430px]">
      <div
        className="pointer-events-none absolute -bottom-4 -right-4 left-4 top-4 border border-site-forest"
        aria-hidden="true"
      />
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-site-paper-2 shadow-[0_30px_70px_rgba(26,26,23,0.16)]">
        <Image
          src="/marketing/hero-before.jpg"
          alt="A shopper in a grey t-shirt and dark trousers"
          fill
          priority
          sizes="(min-width: 1024px) 430px, 90vw"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
          <Image
            src="/marketing/hero-after.jpg"
            alt="The same shopper wearing a light blue shirt"
            fill
            priority
            sizes="(min-width: 1024px) 430px, 90vw"
            className="object-cover"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-site-forest"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-site-forest text-site-paper shadow-lg">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path
                d="M8 6l-5 5 5 5M14 6l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <span className="pointer-events-none absolute left-3.5 top-3.5 bg-site-card px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]">
          Before
        </span>
        <span className="pointer-events-none absolute right-3.5 top-3.5 bg-site-forest px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-site-paper">
          With Mirrae
        </span>

        <input
          type="range"
          min={MIN_POSITION}
          max={MAX_POSITION}
          value={position}
          onChange={handleChange}
          aria-label="Drag to compare the shopper before and after the try-on"
          className="absolute inset-0 m-0 h-full w-full cursor-ew-resize opacity-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-site-forest"
        />
      </div>

      <div className="absolute -right-2 top-8 hidden w-24 flex-col gap-3 xl:flex 2xl:-right-14">
        <HeroThumb src="/marketing/hero-side.jpg" label="Side" />
        <HeroThumb src="/marketing/hero-back.jpg" label="Back" />
      </div>

      <p className="mt-5 text-[11px] text-site-muted">
        Generated with Mirrae · stock photo, back view AI-estimated
      </p>
    </div>
  );
}

type ThumbProps = {
  src: string;
  label: string;
};

function HeroThumb({ src, label }: ThumbProps) {
  return (
    <figure className="m-0">
      <div className="relative h-32 w-24 overflow-hidden border border-site-rule bg-site-card shadow-[0_14px_36px_rgba(26,26,23,0.14)]">
        <Image src={src} alt={`${label} view of the try-on`} fill sizes="96px" className="object-cover" />
      </div>
      <figcaption className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-site-muted">
        {label}
      </figcaption>
    </figure>
  );
}
