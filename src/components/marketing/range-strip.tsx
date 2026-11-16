import Image from 'next/image';

import { Reveal } from '@/components/mirrae/reveal';
import { RANGE_ITEMS } from '@/data/marketing-content';

import { SectionIntro } from './section-intro';

export function RangeStrip() {
  return (
    <section
      id="range"
      aria-labelledby="range-heading"
      className="scroll-mt-16 border-y border-site-rule bg-site-paper-2 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-8">
          <SectionIntro id="range-heading" eyebrow="Category range">
            From a plain shirt <em className="text-site-forest">to a lehenga.</em>
          </SectionIntro>
          <p className="max-w-sm leading-relaxed text-site-ink-2">
            Real try-on results: one stock photo of a person, one product photo, no editing. The small
            square is the garment photo that was used.
          </p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {RANGE_ITEMS.map(item => (
            <li key={item.category}>
              <figure className="m-0">
                <div className="relative aspect-[2/3] overflow-hidden border border-site-rule bg-site-card">
                  <Image
                    src={item.result}
                    alt={`${item.alt}, generated with Mirrae`}
                    fill
                    sizes="(min-width: 1280px) 200px, (min-width: 768px) 30vw, 46vw"
                    className="object-cover"
                  />
                  <div className="absolute bottom-2.5 left-2.5 h-14 w-14 overflow-hidden border-2 border-site-paper shadow-md">
                    <Image
                      src={item.garmentPhoto}
                      alt={`The garment photo used: ${item.garment}`}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                </div>
                <figcaption className="mt-3">
                  <p className="font-lux-display text-2xl font-medium leading-tight">{item.category}</p>
                  <p className="mt-1 text-[13px] text-site-muted">{item.garment}</p>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        <p className="mt-10 flex flex-wrap justify-between gap-x-8 gap-y-2 border-t border-site-rule pt-5 text-[13px] text-site-muted">
          <span>Generated with Mirrae from stock photos · illustrative, not customer results.</span>
          <span>Long garments (saree, lehenga, gown) work best when the shopper wears fitted bottoms.</span>
        </p>
      </div>
    </section>
  );
}
