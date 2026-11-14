import { GoogleAuth } from 'google-auth-library';

/**
 * Shared plumbing for the Vertex AI try-on provider files: auth, endpoint URLs and the error type.
 * Nothing outside src/services/external/ should import this.
 *
 * Env: GOOGLE_CLOUD_PROJECT (required), VERTEX_LOCATION (default us-central1), and credentials via
 * GOOGLE_SERVICE_ACCOUNT_JSON (the key file's JSON) or GOOGLE_APPLICATION_CREDENTIALS (path to a key file);
 * with neither, Application Default Credentials are used (`gcloud auth application-default login`).
 */

const DEFAULT_LOCATION = 'us-central1';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

export class TryOnProviderError extends Error {
  constructor(
    message: string,
    /** HTTP status of the provider answer, when there was one (429 means rate limited). */
    readonly status?: number
  ) {
    super(message);
    this.name = 'TryOnProviderError';
  }
}

export const isTimeoutError = (error: unknown) =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

let googleAuth: GoogleAuth | undefined;

function getGoogleAuth(): GoogleAuth {
  if (googleAuth) return googleAuth;

  const rawCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let credentials: Record<string, unknown> | undefined;
  if (rawCredentials) {
    try {
      credentials = JSON.parse(rawCredentials);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  }
  googleAuth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE], ...(credentials ? { credentials } : {}) });
  return googleAuth;
}

export async function getVertexAccessToken(): Promise<string> {
  try {
    const token = await getGoogleAuth().getAccessToken();
    if (token) return token;
  } catch (error) {
    console.error('Try-on provider authentication failed', error instanceof Error ? error.message : error);
  }
  throw new TryOnProviderError('Try-on provider authentication failed');
}

export function vertexModelUrl(model: string, method: string, locationOverride?: string): string {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is required');
  const location = locationOverride ?? (process.env.VERTEX_LOCATION || DEFAULT_LOCATION);
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  return (
    `https://${host}/v1/projects/${project}/locations/${location}` +
    `/publishers/google/models/${model}:${method}`
  );
}

/** POSTs JSON to Vertex and returns the parsed body, mapping every failure to a generic TryOnProviderError. */
export async function vertexPost(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const accessToken = await getVertexAccessToken();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new TryOnProviderError(isTimeoutError(error) ? 'Try-on provider timed out' : 'Try-on provider request failed');
  }

  if (!response.ok) {
    console.error('Try-on provider error', response.status);
    throw new TryOnProviderError(`Try-on provider returned ${response.status}`, response.status);
  }
  return response.json().catch(() => null);
}
