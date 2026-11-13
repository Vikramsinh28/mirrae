'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { uploadFileViaPresignedUrl } from '@/services/external/aws/presigned-upload';
import { getUploadPurposeConfig } from '@/services/internal/files/file-upload/file-upload-config';
import { UploadPurpose } from '@/types/file-upload';

interface TryOnImageFieldProps {
  label: string;
  uploadPurpose: Extract<UploadPurpose, 'TryOnPerson' | 'TryOnProduct'>;
  userId: number;
  valueKey: string | null;
  previewUrl: string | null;
  onUploaded: (_key: string, _previewUrl: string) => void;
  onCleared: () => void;
  disabled?: boolean;
}

export function TryOnImageField({
  label,
  uploadPurpose,
  userId,
  valueKey,
  previewUrl,
  onUploaded,
  onCleared,
  disabled = false,
}: TryOnImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purposeConfig = getUploadPurposeConfig(uploadPurpose);
  const accept = purposeConfig?.allowedMimeTypes.join(',') ?? 'image/jpeg,image/png,image/webp';
  const maxBytes = purposeConfig?.maxFileSize ?? 8 * 1024 * 1024;

  const handlePick = () => {
    if (disabled || isUploading) return;
    setError(null);
    inputRef.current?.click();
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const clearInput = () => {
      event.target.value = '';
    };

    if (file.size > maxBytes) {
      setError(`File must be under ${Math.round(maxBytes / (1024 * 1024))}MB`);
      clearInput();
      return;
    }
    if (purposeConfig && !purposeConfig.allowedMimeTypes.includes(file.type)) {
      setError('Use a JPG, PNG, or WebP image');
      clearInput();
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setIsUploading(true);
    setError(null);

    try {
      const { key } = await uploadFileViaPresignedUrl({
        file,
        uploadPurpose,
        objectName: 'u',
        objectId: userId,
      });
      onUploaded(key, localPreview);
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      clearInput();
    }
  };

  const handleClear = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    onCleared();
    setError(null);
  };

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled || isUploading}
      />
      {valueKey && previewUrl ? (
        <div className="relative overflow-hidden rounded-md border border-border bg-muted/30">
          <div className="relative aspect-[3/4] w-full max-h-72 sm:max-h-80">
            <img src={previewUrl} alt={label} className="absolute inset-0 size-full object-cover" />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute top-2 right-2"
            onClick={handleClear}
            disabled={disabled || isUploading}
            aria-label={`Remove ${label}`}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={disabled || isUploading}
          aria-label={`${label}, tap to upload`}
          aria-busy={isUploading}
          className="flex aspect-[3/4] w-full max-h-72 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-3 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-50 sm:max-h-80"
        >
          {isUploading ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="size-5" />
              Tap to upload
            </>
          )}
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Field>
  );
}
