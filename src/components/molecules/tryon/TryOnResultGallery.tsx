'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import type { TryOnDoneResponse } from '@/services/api/tryon';
import { cn } from '@/lib/utils';

type ViewName = 'front' | 'side' | 'back';

interface ViewItem {
  name: ViewName;
  label: string;
  url?: string;
}

interface TryOnResultGalleryProps {
  result: TryOnDoneResponse;
}

const toViews = (result: TryOnDoneResponse): ViewItem[] => [
  { name: 'front', label: 'Front', url: result.resultUrl },
  { name: 'side', label: 'Side', url: result.sideUrl },
  { name: 'back', label: 'Back', url: result.backUrl },
];

/** Large preview of the selected view with a thumbnail strip. Shows spinners while extra views generate. */
export function TryOnResultGallery({ result }: TryOnResultGalleryProps) {
  const [selected, setSelected] = useState<ViewName>('front');

  const isMultiView = result.viewCount > 1;
  // A view that never arrived (failed) is hidden once nothing more is pending.
  const views = toViews(result).filter(
    view => view.name === 'front' || (isMultiView && (view.url || result.extrasPending))
  );
  const current = views.find(view => view.name === selected && view.url) ?? views[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-border bg-muted/30">
        <img
          src={current.url}
          alt={`Try-on result, ${current.label.toLowerCase()} view`}
          className="absolute inset-0 size-full object-contain"
        />
      </div>

      {views.length > 1 && (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Try-on views">
          {views.map(view => (
            <button
              key={view.name}
              type="button"
              disabled={!view.url}
              aria-pressed={view.name === current.name}
              onClick={() => setSelected(view.name)}
              className={cn(
                'relative aspect-[3/4] overflow-hidden rounded-md border bg-muted/30 text-xs',
                view.name === current.name ? 'border-foreground' : 'border-border',
                !view.url && 'cursor-wait'
              )}
            >
              {view.url ? (
                <img src={view.url} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-background/80 py-0.5 text-center">{view.label}</span>
            </button>
          ))}
        </div>
      )}

      {result.extrasPending && (
        <p role="status" className="text-xs text-muted-foreground">
          Front view is ready. Generating the side and back views…
        </p>
      )}
      {isMultiView && !result.extrasPending && !result.sideUrl && !result.backUrl && (
        <p className="text-xs text-muted-foreground">
          Side and back views could not be generated this time, so only 1 credit was used.
        </p>
      )}
    </div>
  );
}
