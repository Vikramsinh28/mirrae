import { FileImage, Upload } from 'lucide-react';

import { TryOnFigure } from './try-on-figure';

const PROGRESS_LABELS = ['Reading pose', 'Fitting the garment', 'Rendering the result'] as const;

type Props = {
  step: number;
};

/** Small illustrative panel for each step of the flow. Decorative. */
export function StepVisual({ step }: Props) {
  if (step === 0) {
    return (
      <div className="flex h-full min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-mirrae-gold/50 bg-mirrae-paper p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mirrae-ink text-mirrae-gold-soft">
          <Upload size={24} aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-mirrae-ink">Drop a photo here</p>
        <span className="inline-flex items-center gap-2 rounded-full border border-mirrae-line bg-white px-3 py-1.5 text-xs text-mirrae-stone">
          <FileImage size={14} aria-hidden="true" />
          me-in-the-garden.jpg
        </span>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="flex h-full min-h-56 flex-col justify-center gap-5 rounded-2xl bg-mirrae-ink p-6">
        {PROGRESS_LABELS.map((label, index) => (
          <div key={label}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-white/70">
              {label}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="mirrae-twinkle h-full rounded-full bg-mirrae-gold-soft"
                style={{ width: `${88 - index * 24}%`, animationDelay: `${index * 0.6}s` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-56 overflow-hidden rounded-2xl">
      <TryOnFigure variant="after" />
      <span className="absolute left-3 top-3 rounded-full bg-mirrae-gold-soft px-3 py-1 text-[11px] font-semibold text-mirrae-ink">
        Try-on result
      </span>
    </div>
  );
}
