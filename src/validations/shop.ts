import { z } from 'zod';

/**
 * Input rules for a merchant's shop. The allowed websites decide who can use the shop's public key and the
 * image hosts decide where the server may download product photos from, so both are checked strictly:
 * no wildcards, https only (http only for localhost while developing), no credentials.
 */

const MAX_NAME_LENGTH = 80;
const MAX_LIST_ITEMS = 10;
const MAX_DAILY_CAP = 2000;
const MAX_USAGE_DAYS = 365;
const DEFAULT_USAGE_DAYS = 30;

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/;

// Developers test on their own machine: localhost is only accepted outside production.
const allowLocalhost = () => process.env.NODE_ENV !== 'production';

function isValidHost(host: string, { localhost }: { localhost: boolean }): boolean {
  if (host === 'localhost') return localhost && allowLocalhost();
  return HOSTNAME.test(host);
}

/** A plain host name from what a merchant typed or pasted (a bare domain or a full page url). */
function toHostname(value: string, options: { localhost: boolean }): string | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (SCHEME.test(text) && !/^https?:\/\//.test(text)) return null;

  let url: URL;
  try {
    url = new URL(SCHEME.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;

  const host = url.hostname.replace(/\.$/, '');
  return isValidHost(host, options) ? host : null;
}

/** An origin (scheme + host + port) from a full website address, or null when it is not acceptable. */
function toOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const secure = url.protocol === 'https:';
  const localDevelopment = url.protocol === 'http:' && host === 'localhost' && allowLocalhost();
  if (!(secure || localDevelopment) || !isValidHost(host, { localhost: true })) return null;

  return url.origin;
}

const unique = <T>(items: readonly T[]): T[] => Array.from(new Set(items));

export const domainSchema = z
  .string()
  .max(2048)
  .transform((value, context) => {
    const host = toHostname(value, { localhost: true });
    if (!host) {
      context.addIssue({ code: 'custom', message: 'Enter your website address, like www.example.com' });
      return z.NEVER;
    }
    return host;
  });

const originSchema = z
  .string()
  .max(300)
  .transform((value, context) => {
    const origin = toOrigin(value);
    if (!origin) {
      context.addIssue({ code: 'custom', message: 'Enter a full website address, like https://www.example.com' });
      return z.NEVER;
    }
    return origin;
  });

const imageHostSchema = z
  .string()
  .max(2048)
  .transform((value, context) => {
    const host = toHostname(value, { localhost: false });
    if (!host) {
      context.addIssue({ code: 'custom', message: 'Enter a host name, like cdn.example.com' });
      return z.NEVER;
    }
    return host;
  });

const nameSchema = z.string().trim().min(1, 'Enter a name').max(MAX_NAME_LENGTH);

/** The website addresses a new shop starts with: its own domain with and without www. */
function defaultOrigins(host: string): string[] {
  if (host === 'localhost') return ['http://localhost:3000'];
  const counterpart = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
  return [`https://${host}`, `https://${counterpart}`];
}

export const createShopSchema = z
  .object({ name: nameSchema, domain: domainSchema })
  .transform(({ name, domain }) => ({
    name,
    domain,
    allowedOrigins: defaultOrigins(domain),
    imageHosts: [] as string[],
  }));

// Merchants can pause and resume; SUSPENDED and UNINSTALLED are set by us, never by them.
const merchantStatusSchema = z.enum(['ACTIVE', 'PAUSED']);

export const shopSwitchSchema = z.object({ status: merchantStatusSchema });

export const updateShopSchema = z
  .object({
    name: nameSchema,
    allowedOrigins: z.array(originSchema).min(1).max(MAX_LIST_ITEMS).transform(unique),
    imageHosts: z.array(imageHostSchema).max(MAX_LIST_ITEMS).transform(unique),
    dailyTryOnCap: z.number().int().min(1).max(MAX_DAILY_CAP),
    status: merchantStatusSchema,
  })
  .partial()
  .refine(update => Object.keys(update).length > 0, { message: 'Nothing to update' });

export const usageQuerySchema = z.object({
  days: z.preprocess(
    value => (value === undefined || value === null ? DEFAULT_USAGE_DAYS : /^\d+$/.test(String(value)) ? Number(value) : Number.NaN),
    z.number().int().min(1).max(MAX_USAGE_DAYS)
  ),
});

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
