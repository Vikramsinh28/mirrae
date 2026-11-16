/**
 * Lets the shopper keep or share their try-on image. Phones get the native share sheet (WhatsApp, Instagram…),
 * desktops get a download. If the image cannot be fetched as a file (for example the storage bucket has no CORS
 * rule for this store yet) the image opens in a new tab so the shopper can still long-press or right-click it.
 */

const FILE_NAME = 'mirrae-try-on.jpg';

export type ShareOutcome = 'shared' | 'downloaded' | 'opened' | 'cancelled';

export interface ShareDeps {
  fetch: typeof fetch;
  navigator: Pick<Navigator, 'canShare' | 'share'> | undefined;
  download: (blob: Blob, fileName: string) => void;
  open: (url: string) => void;
}

function browserDownload(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

const defaultDeps = (): ShareDeps => ({
  fetch: (...args) => fetch(...args),
  navigator: typeof navigator === 'undefined' ? undefined : navigator,
  download: browserDownload,
  open: url => window.open(url, '_blank', 'noopener'),
});

export async function shareImage(url: string, deps: ShareDeps = defaultDeps()): Promise<ShareOutcome> {
  let blob: Blob;
  try {
    const response = await deps.fetch(url);
    if (!response.ok) throw new Error('image not available');
    blob = await response.blob();
  } catch {
    deps.open(url);
    return 'opened';
  }

  const file = new File([blob], FILE_NAME, { type: blob.type || 'image/jpeg' });
  if (deps.navigator?.canShare?.({ files: [file] })) {
    try {
      await deps.navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      // Closing the share sheet is not a failure and must not trigger a surprise download.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }

  deps.download(blob, FILE_NAME);
  return 'downloaded';
}
