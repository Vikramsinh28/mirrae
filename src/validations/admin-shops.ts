import { z } from 'zod';

/** Input rules for the admin panel's platform overview and shop list. */

const MAX_DAYS = 90;
const DEFAULT_DAYS = 7;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 100;

const emptyToUndefined = (value: unknown) => (value === null || value === '' ? undefined : value);

const wholeNumber = (fallback: number) => (value: unknown) =>
  value === undefined || value === null || value === '' ? fallback : /^\d+$/.test(String(value)) ? Number(value) : Number.NaN;

export const adminStatsQuerySchema = z.object({
  days: z.preprocess(wholeNumber(DEFAULT_DAYS), z.number().int().min(1).max(MAX_DAYS)),
});

export const adminShopsQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(MAX_SEARCH_LENGTH).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(['ACTIVE', 'PAUSED', 'SUSPENDED', 'UNINSTALLED']).optional()),
  platform: z.preprocess(emptyToUndefined, z.enum(['WEB', 'SHOPIFY']).optional()),
  limit: z.preprocess(wholeNumber(DEFAULT_PAGE_SIZE), z.number().int().min(1).max(MAX_PAGE_SIZE)),
  offset: z.preprocess(wholeNumber(0), z.number().int().min(0)),
});

// An admin can suspend a shop or let it back in. PAUSED is the merchant's own switch and UNINSTALLED is Shopify's.
export const adminShopStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });

const MAX_CREDIT_ADJUSTMENT = 10_000;
const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 200;

/** Credits an admin adds (positive) or removes (negative): non-zero, bounded, at most two decimals, and always with a reason. */
export const adminCreditAdjustmentSchema = z.object({
  amount: z
    .number()
    .finite()
    .refine(amount => amount !== 0, 'The amount cannot be zero')
    .refine(amount => Math.abs(amount) <= MAX_CREDIT_ADJUSTMENT, `At most ${MAX_CREDIT_ADJUSTMENT} credits at a time`)
    .refine(amount => Math.round(amount * 100) / 100 === amount, 'At most two decimals'),
  reason: z.string().trim().min(MIN_REASON_LENGTH, 'Say why').max(MAX_REASON_LENGTH),
});

export type AdminCreditAdjustment = z.infer<typeof adminCreditAdjustmentSchema>;
export type AdminShopsQuery = z.infer<typeof adminShopsQuerySchema>;
