'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { TryOnImageField } from '@/components/molecules/tryon/TryOnImageField';
import { TryOnResultGallery } from '@/components/molecules/tryon/TryOnResultGallery';
import { TryOnViewsPicker } from '@/components/molecules/tryon/TryOnViewsPicker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCreateTryOn, useTryOnStatus } from '@/hooks/useTryOn';
import type { TryOnViewsOption } from '@/services/api/tryon';
import { useAuthStore } from '@/store/auth';

export default function TryOnPage() {
  const user = useAuthStore(state => state.user);
  const userId = user?.id ? Number(user.id) : null;

  const [personKey, setPersonKey] = useState<string | null>(null);
  const [productKey, setProductKey] = useState<string | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [views, setViews] = useState<TryOnViewsOption>('multi');
  const [consent, setConsent] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createTryOn = useCreateTryOn();
  const statusQuery = useTryOnStatus(jobId);

  const isCreating = createTryOn.isPending;
  const status = statusQuery.data;
  const isTerminal = status?.status === 'done' || status?.status === 'failed';
  // Stay busy for the active job even if a status refetch errors — do not unlock a second charge.
  const isPolling = !!jobId && !isTerminal;
  const isBusy = isCreating || isPolling;

  const canSubmit =
    !!userId && !!personKey && !!productKey && consent && !isBusy && status?.status !== 'done';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !personKey || !productKey) return;

    setFormError(null);
    setJobId(null);

    try {
      const result = await createTryOn.mutateAsync({
        personImageKey: personKey,
        productImageKey: productKey,
        views,
        consent: true,
      });
      setJobId(result.jobId);
    } catch {
      setFormError('Could not start try-on. Check your credits and try again.');
    }
  };

  const handleReset = () => {
    setJobId(null);
    setFormError(null);
    createTryOn.reset();
  };

  if (!userId) {
    return (
      <div className="min-h-screen">
        <PageHeaderWithAction title="Try on" description="See clothes on you" />
        <div className="p-4 text-sm text-muted-foreground">Sign in to run a try-on.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeaderWithAction title="Try it on your product" description="See what your shoppers will see" />

      <div className="mx-auto w-full max-w-lg p-4 max-sm:p-3">
        <p className="mb-4 text-xs text-muted-foreground">
          This is the same try-on your shoppers get. Use a product photo from your store. It uses your credits (1 for the
          front view, 2 with side and back), and nothing is charged if the try-on fails.
        </p>
        {status?.status === 'done' ? (
          <div className="flex flex-col gap-4">
            <TryOnResultGallery result={status} />
            <Button type="button" variant="secondary" onClick={handleReset} className="w-full">
              Try another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TryOnImageField
                label="Your photo"
                uploadPurpose="TryOnPerson"
                userId={userId}
                valueKey={personKey}
                previewUrl={personPreview}
                onUploaded={(key, preview) => {
                  setPersonKey(key);
                  setPersonPreview(preview);
                }}
                onCleared={() => {
                  setPersonKey(null);
                  setPersonPreview(null);
                }}
                disabled={isBusy}
              />
              <TryOnImageField
                label="Product image"
                uploadPurpose="TryOnProduct"
                userId={userId}
                valueKey={productKey}
                previewUrl={productPreview}
                onUploaded={(key, preview) => {
                  setProductKey(key);
                  setProductPreview(preview);
                }}
                onCleared={() => {
                  setProductKey(null);
                  setProductPreview(null);
                }}
                disabled={isBusy}
              />
            </div>

            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              <li>Your photo: standing straight, head to toe, facing the camera, plain background.</li>
              <li>Product photo: the garment from the front, clean background, no watermark or text.</li>
            </ul>

            <TryOnViewsPicker value={views} onChange={setViews} disabled={isBusy} />

            <div className="flex items-start gap-2">
              <Checkbox
                id="tryon-consent"
                checked={consent}
                onCheckedChange={checked => setConsent(checked === true)}
                disabled={isBusy}
              />
              <Label htmlFor="tryon-consent" className="text-xs leading-snug font-normal">
                I consent to my photo being processed for this virtual try-on. The photo is deleted
                after the result is ready.
              </Label>
            </div>

            {(isCreating || isPolling) && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" />
                {isCreating ? 'Starting try-on…' : 'Generating your look… this can take up to a minute.'}
              </div>
            )}

            {status?.status === 'failed' && (
              <p role="alert" className="text-xs text-destructive">
                {status.error}
              </p>
            )}
            {statusQuery.isError && !isTerminal && (
              <p role="alert" className="text-xs text-destructive">
                Could not check try-on status. Retrying…
              </p>
            )}
            {formError && (
              <p role="alert" className="text-xs text-destructive">
                {formError}
              </p>
            )}

            <Button type="submit" disabled={!canSubmit} className="w-full" size="lg">
              {isCreating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting…
                </>
              ) : isPolling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Working…
                </>
              ) : (
                `Try on (${views === 'multi' ? '2 credits' : '1 credit'})`
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
