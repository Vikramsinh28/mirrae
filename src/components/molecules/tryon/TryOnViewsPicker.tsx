'use client';

import { cn } from '@/lib/utils';
import type { TryOnViewsOption } from '@/services/api/tryon';

interface TryOnViewsPickerProps {
  value: TryOnViewsOption;
  onChange: (_views: TryOnViewsOption) => void;
  disabled?: boolean;
}

const OPTIONS: { value: TryOnViewsOption; title: string; detail: string }[] = [
  { value: 'single', title: 'Front view', detail: '1 credit' },
  { value: 'multi', title: 'Front, side and back', detail: '2 credits' },
];

export function TryOnViewsPicker({ value, onChange, disabled = false }: TryOnViewsPickerProps) {
  return (
    <div role="group" aria-label="Number of views" className="grid grid-cols-2 gap-2">
      {OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md border px-3 py-2 text-left text-xs transition-colors disabled:opacity-60',
            value === option.value ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/30'
          )}
        >
          <span className="block font-medium">{option.title}</span>
          <span className="block text-muted-foreground">{option.detail}</span>
        </button>
      ))}
    </div>
  );
}
