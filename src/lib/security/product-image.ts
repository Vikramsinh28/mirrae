import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * Downloads a product image from a URL a storefront gave us, without letting that URL reach our network.
 * The URL is attacker-influenced (it comes from a public widget), so this is an SSRF guard:
 *  - https only, default port, no credentials, no IP literals;
 *  - the host must be on the shop's allowlist (the shop's own domain, its image CDN);
 *  - every address the host resolves to must be public (not private, loopback, link-local or metadata);
 *  - redirects are never followed; size and time are capped; only jpeg/png/webp are accepted.
 * A DNS answer can change between our lookup and fetch's own lookup (rebinding); the allowlist keeps that
 * to hosts the merchant chose, which is why the allowlist is mandatory, not optional.
 */

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class ProductImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductImageError';
  }
}

const NON_PUBLIC = new BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([network, prefix]) => NON_PUBLIC.addSubnet(network as string, prefix as number, 'ipv4'));
[
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
].forEach(([network, prefix]) => NON_PUBLIC.addSubnet(network as string, prefix as number, 'ipv6'));

const MAPPED_IPV4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

function isPublicAddress(address: string, family: number): boolean {
  const mapped = MAPPED_IPV4.exec(address);
  if (mapped) return !NON_PUBLIC.check(mapped[1], 'ipv4');
  return !NON_PUBLIC.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

function parseAllowedUrl(rawUrl: string, allowedHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ProductImageError('Invalid image url');
  }

  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') throw new ProductImageError('Image url must be https');
  if (url.username || url.password) throw new ProductImageError('Image url must not contain credentials');
  if (url.port && url.port !== '443') throw new ProductImageError('Image url must use the default port');
  if (isIP(host.replace(/^\[|\]$/g, '')) !== 0) throw new ProductImageError('Image url must use a host name');

  const allowed = allowedHosts.some(allowedHost => host === allowedHost || host.endsWith(`.${allowedHost}`));
  if (!allowed) throw new ProductImageError('Image host is not allowed for this shop');
  return url;
}

async function assertResolvesToPublicAddresses(host: string): Promise<void> {
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ProductImageError('Image host could not be resolved');
  }
  if (addresses.length === 0 || !addresses.every(({ address, family }) => isPublicAddress(address, family))) {
    throw new ProductImageError('Image host resolves to a non-public address');
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ProductImageError('Image is too large');

  const reader = response.body?.getReader();
  if (!reader) throw new ProductImageError('Image has no content');

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ProductImageError('Image is too large');
    }
    chunks.push(value);
  }
  if (total === 0) throw new ProductImageError('Image has no content');

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchProductImage(
  rawUrl: string,
  {
    allowedHosts,
    maxBytes = DEFAULT_MAX_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: { allowedHosts: readonly string[]; maxBytes?: number; timeoutMs?: number }
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const url = parseAllowedUrl(rawUrl, allowedHosts);
  await assertResolvesToPublicAddresses(url.hostname.toLowerCase());

  let response: Response;
  try {
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ProductImageError('Image could not be downloaded');
  }
  if (!response.ok) throw new ProductImageError('Image could not be downloaded');

  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!ACCEPTED_TYPES.has(contentType)) throw new ProductImageError('Image must be JPEG, PNG or WebP');

  return { bytes: await readCapped(response, maxBytes), contentType };
}
