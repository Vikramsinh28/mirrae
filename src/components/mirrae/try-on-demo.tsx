import { BeforeAfterSlider } from './before-after-slider';
import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';
import { Starfield } from './starfield';

export function TryOnDemo() {
  return (
    <section
      id="demo"
      aria-labelledby="demo-heading"
      className="relative isolate scroll-mt-16 overflow-hidden bg-mirrae-ink px-6 pb-24 pt-28 text-white sm:pb-32 sm:pt-36"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_75%_50%,rgba(224,179,95,0.14),transparent)]"
        aria-hidden="true"
      />
      <Starfield count={36} />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.85fr] lg:gap-24">
        <div>
          <SectionHeading
            id="demo-heading"
            eyebrow="See it happen"
            tone="ink"
            intro="Drag the line, tap the buttons or use the arrow keys. This is the moment a shopper goes from “maybe” to “that’s the one.”"
          >
            Drag the line. <em>See the fit.</em>
          </SectionHeading>
          <Reveal delay={0.12}>
            <dl className="mt-12 grid max-w-lg grid-cols-2 gap-x-10 gap-y-8 border-t border-white/10 pt-8">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-mirrae-gold-soft">
                  Input
                </dt>
                <dd className="mt-2 text-white/80">One shopper photo and your product image</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-mirrae-gold-soft">
                  Output
                </dt>
                <dd className="mt-2 text-white/80">A realistic composite in about 20–40 seconds</dd>
              </div>
            </dl>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mx-auto w-full max-w-md lg:max-w-none">
          <BeforeAfterSlider />
        </Reveal>
      </div>
    </section>
  );
}
