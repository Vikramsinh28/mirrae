/**
 * Lets the shopper keep or share their try-on image. Phones get the native share sheet (WhatsApp, Instagram…),
 * desktops get a download. If the image cannot be fetched as a file (for example the storage bucket has no CORS
 * rule for this store yet) nothing is opened: a new tab opened after the fetch would be blocked as a popup, since
 * the click's user activation is gone by then. The caller tells the shopper to press and hold the picture instead.
 */

const FILE_NAME = 'mirrae-try-on.jpg';

export type ShareOutcome = 'shared' | 'downloaded' | 'manual' | 'cancelled';

export interface ShareDeps {
  fetch: typeof fetch;
  navigator: Pick<Navigator, 'canShare' | 'share'> | undefined;
  download: (blob: Blob, fileName: string) => void;
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
});

export async function shareImage(url: string, deps: ShareDeps = defaultDeps()): Promise<ShareOutcome> {
  let blob: Blob;
  try {
    const response = await deps.fetch(url);
    if (!response.ok) throw new Error('image not available');
    blob = await response.blob();
  } catch {
    return 'manual';
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
