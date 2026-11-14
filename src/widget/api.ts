/** Talks to the Mirrae storefront API: session, photo upload, try-on, polling. No dependencies, browser only. */

export class WidgetApiError extends Error {
  constructor(
    readonly code: string,
    message: string = code,
    readonly status: number = 0,
    readonly problem?: string,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'WidgetApiError';
  }
}

export interface ApiDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export interface DoneStatus {
  status: 'done';
  resultUrl: string;
  sideUrl?: string;
  backUrl?: string;
  viewCount: number;
  extrasPending: boolean;
}

export type JobProgress = { status: 'queued' | 'processing' } | DoneStatus;

export interface ApiConfig {
  apiBase: string;
  publicKey: string;
}

const TOKEN_HEADER = 'X-Storefront-Token';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const POLL_INTERVAL_MS = 2_000;
const JOB_TIMEOUT_MS = 4 * 60 * 1000;
// After the front view is ready the side and back views get this long, then the shopper keeps the front view.
const EXTRAS_GRACE_MS = 2.5 * 60 * 1000;
const MAX_CONSECUTIVE_NETWORK_ERRORS = 3;

const defaultDeps: ApiDeps = {
  fetch: (...args) => fetch(...args),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: BodyInit;
  auth?: boolean;
}

export function createApi({ apiBase, publicKey }: ApiConfig, deps: ApiDeps = defaultDeps) {
  let token: string | null = null;
  let opening: Promise<string> | null = null;

  async function send(path: string, { method = 'GET', headers = {}, body }: RequestOptions): Promise<unknown> {
    let response: Response;
    try {
      response = await deps.fetch(`${apiBase}${path}`, { method, headers, body });
    } catch {
      throw new WidgetApiError('NETWORK');
    }

    let payload: { success?: boolean; data?: unknown; code?: string; message?: string; problem?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (response.ok && payload?.success) return payload.data;

    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new WidgetApiError(
      payload?.code ?? 'SERVER_ERROR',
      payload?.message,
      response.status,
      payload?.problem,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined
    );
  }

  function ensureSession(): Promise<string> {
    if (token) return Promise.resolve(token);
    opening ??= send('/api/storefront/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey }),
    })
      .then(data => {
        token = (data as { token: string }).token;
        return token;
      })
      .finally(() => {
        opening = null;
      });
    return opening;
  }

  /** An authenticated call; an expired session is reopened and the call retried exactly once. */
  async function call(path: string, options: RequestOptions): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const sessionToken = await ensureSession();
      try {
        return await send(path, { ...options, headers: { ...options.headers, [TOKEN_HEADER]: sessionToken } });
      } catch (error) {
        if (error instanceof WidgetApiError && error.code === 'INVALID_TOKEN' && attempt === 0) {
          token = null;
          continue;
        }
        throw error;
      }
    }
  }

  return {
    async uploadPhoto(photo: Blob): Promise<{ photoKey: string }> {
      if (!photo.type.startsWith('image/')) throw new WidgetApiError('INVALID_PHOTO');
      if (photo.size > MAX_PHOTO_BYTES) throw new WidgetApiError('PAYLOAD_TOO_LARGE');

      return (await call('/api/storefront/photo', {
        method: 'POST',
        headers: { 'Content-Type': photo.type },
        body: photo,
      })) as { photoKey: string };
    },

    async startTryOn(input: {
      photoKey: string;
      productImageUrl: string;
      views: 'single' | 'multi';
    }): Promise<{ jobId: string }> {
      // The shopper ticked the consent box before this call is ever made.
      return (await call('/api/storefront/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, consent: true }),
      })) as { jobId: string };
    },

    /** Resolves when every view is ready, or with what is ready once the side/back views take too long. */
    async waitForResult(
      jobId: string,
      { onUpdate, signal }: { onUpdate?: (progress: JobProgress) => void; signal?: AbortSignal }
    ): Promise<DoneStatus> {
      const startedAt = deps.now();
      let frontReadyAt: number | null = null;
      let networkErrors = 0;

      for (;;) {
        if (signal?.aborted) throw new WidgetApiError('ABORTED');

        let progress: JobProgress | { status: 'failed'; error: string };
        try {
          progress = (await call(`/api/storefront/status?jobId=${encodeURIComponent(jobId)}`, {})) as typeof progress;
          networkErrors = 0;
        } catch (error) {
          const blip = error instanceof WidgetApiError && error.code === 'NETWORK';
          if (!blip || ++networkErrors > MAX_CONSECUTIVE_NETWORK_ERRORS) throw error;
          await deps.sleep(POLL_INTERVAL_MS);
          continue;
        }

        if (progress.status === 'failed') throw new WidgetApiError('JOB_FAILED');
        onUpdate?.(progress);

        if (progress.status === 'done') {
          frontReadyAt ??= deps.now();
          if (!progress.extrasPending || deps.now() - frontReadyAt >= EXTRAS_GRACE_MS) return progress;
        } else if (deps.now() - startedAt >= JOB_TIMEOUT_MS) {
          throw new WidgetApiError('TIMEOUT');
        }

        await deps.sleep(POLL_INTERVAL_MS);
      }
    },
  };
}

export type Api = ReturnType<typeof createApi>;
