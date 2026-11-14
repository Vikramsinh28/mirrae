import { randomUUID } from 'node:crypto';

import { fetchProductImage, ProductImageError } from '@/lib/security/product-image';
import { storefrontLimits } from '@/lib/storefront/limits';
import { signStorefrontToken, verifyStorefrontToken, type StorefrontSession } from '@/lib/storefront/token';
import type { Shop } from '@/lib/prisma/generated/client';
import { putObject } from '@/services/external/aws/s3';
import { findPersonProblem, type PhotoProblem } from '@/services/external/tryon-check';
import * as shopRepo from '@/services/repositories/shop';
import { PHOTO_PROBLEM_MESSAGES, TryOnService, type TryOnStatusResult, type TryOnViews } from './tryon';
import { prepareTryOnImage } from './tryon-image';

/**
 * The anonymous storefront API: a shopper on a merchant's website, with no account, starts a try-on that the
 * merchant (the shop owner) pays for. Everything here assumes hostile callers: a signed session token bound
 * to one shop and an allowed origin, rate limits, a per-shop daily cap, safe product image downloads, and
 * keys that only this shopper session can use.
 */

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type StorefrontFailure =
  | 'UNKNOWN_SHOP'
  | 'SHOP_INACTIVE'
  | 'ORIGIN_NOT_ALLOWED'
  | 'INVALID_TOKEN'
  | 'RATE_LIMITED';

type Rejected<Reason extends string> = { ok: false; reason: Reason; retryAfterMs?: number };

type Authorized = { ok: true; shop: Shop; session: StorefrontSession } | Rejected<StorefrontFailure>;

const originAllowed = (shop: Shop, origin: string) => origin !== '' && shop.allowedOrigins.includes(origin);

const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

function rateLimited(...checks: ReturnType<typeof storefrontLimits.sessionByIp.check>[]): Rejected<'RATE_LIMITED'> | null {
  const blocked = checks.find(check => !check.allowed);
  return blocked ? { ok: false, reason: 'RATE_LIMITED', retryAfterMs: blocked.retryAfterMs } : null;
}

async function authorize(token: string, origin: string): Promise<Authorized> {
  const session = verifyStorefrontToken(token);
  if (!session) return { ok: false, reason: 'INVALID_TOKEN' };

  const shop = await shopRepo.findShopById(session.shopId);
  if (!shop) return { ok: false, reason: 'INVALID_TOKEN' };
  if (shop.status !== 'ACTIVE') return { ok: false, reason: 'SHOP_INACTIVE' };
  if (!originAllowed(shop, origin)) return { ok: false, reason: 'ORIGIN_NOT_ALLOWED' };

  return { ok: true, shop, session };
}

export class StorefrontService {
  static async openSession(input: { publicKey: string; origin: string; ip: string }): Promise<
    { ok: true; token: string; shopName: string } | Rejected<StorefrontFailure>
  > {
    const limited = rateLimited(storefrontLimits.sessionByIp.check(input.ip));
    if (limited) return limited;

    const shop = await shopRepo.findShopByPublicKey(input.publicKey);
    if (!shop) return { ok: false, reason: 'UNKNOWN_SHOP' };
    if (shop.status !== 'ACTIVE') return { ok: false, reason: 'SHOP_INACTIVE' };
    if (!originAllowed(shop, input.origin)) return { ok: false, reason: 'ORIGIN_NOT_ALLOWED' };

    const token = signStorefrontToken({ shopId: shop.id, sessionId: randomUUID() });
    return { ok: true, token, shopName: shop.name };
  }

  /**
   * Cleans the shopper photo, checks it for a person right away (so a bad photo is reported in seconds,
   * before any try-on starts) and stores it under this shop and session.
   */
  static async uploadPhoto(input: { token: string; origin: string; ip: string; bytes: Uint8Array }): Promise<
    | { ok: true; photoKey: string }
    | { ok: false; reason: 'INVALID_PHOTO' }
    | { ok: false; reason: 'PHOTO_PROBLEM'; problem: PhotoProblem; message: string }
    | Rejected<StorefrontFailure>
  > {
    const auth = await authorize(input.token, input.origin);
    if (!auth.ok) return auth;

    const limited = rateLimited(
      storefrontLimits.photoBySession.check(auth.session.sessionId),
      storefrontLimits.photoByIp.check(input.ip)
    );
    if (limited) return limited;

    if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_PHOTO_BYTES) {
      return { ok: false, reason: 'INVALID_PHOTO' };
    }

    let prepared: Awaited<ReturnType<typeof prepareTryOnImage>>;
    try {
      prepared = await prepareTryOnImage(input.bytes);
    } catch {
      return { ok: false, reason: 'INVALID_PHOTO' };
    }

    const problem = await findPersonProblem(prepared);
    if (problem) return { ok: false, reason: 'PHOTO_PROBLEM', problem, message: PHOTO_PROBLEM_MESSAGES[problem] };

    const { key } = await putObject(
      'TryOnPerson',
      auth.shop.id,
      auth.session.sessionId,
      prepared.contentType,
      new Uint8Array(Buffer.from(prepared.base64, 'base64'))
    );
    return { ok: true, photoKey: key };
  }

  static async startTryOn(input: {
    token: string;
    origin: string;
    ip: string;
    photoKey: string;
    productImageUrl: string;
    views: TryOnViews;
    consent: boolean;
  }): Promise<
    | { ok: true; jobId: string }
    | { ok: false; reason: 'DAILY_CAP_REACHED' | 'INVALID_PRODUCT_IMAGE' | 'INVALID_PHOTO' | 'CONSENT_REQUIRED' | 'INSUFFICIENT_CREDITS' }
    | Rejected<StorefrontFailure>
  > {
    const auth = await authorize(input.token, input.origin);
    if (!auth.ok) return auth;
    const { shop, session } = auth;

    const limited = rateLimited(
      storefrontLimits.tryOnBySession.check(session.sessionId),
      storefrontLimits.tryOnByIp.check(input.ip)
    );
    if (limited) return limited;

    const startedToday = await shopRepo.countShopJobsSince(shop.id, startOfUtcDay(new Date()));
    if (startedToday >= shop.dailyTryOnCap) return { ok: false, reason: 'DAILY_CAP_REACHED' };

    let product: Awaited<ReturnType<typeof fetchProductImage>>;
    try {
      product = await fetchProductImage(input.productImageUrl, { allowedHosts: [...shop.imageHosts, shop.domain] });
    } catch (error) {
      if (error instanceof ProductImageError) return { ok: false, reason: 'INVALID_PRODUCT_IMAGE' };
      throw error;
    }

    const { key: productImageKey } = await putObject(
      'TryOnProduct',
      shop.id,
      session.sessionId,
      product.contentType,
      product.bytes
    );

    const created = await TryOnService.createJob({
      userId: shop.ownerId,
      personImageKey: input.photoKey,
      productImageKey,
      consent: input.consent,
      views: input.views,
      storefront: { shopId: shop.id, sessionId: session.sessionId },
    });
    if (created.ok) return { ok: true, jobId: created.jobId };

    return { ok: false, reason: created.reason === 'INVALID_KEY' ? 'INVALID_PHOTO' : created.reason };
  }

  /** The caller starts processing (after the response is sent) with TryOnService.processJob(jobId). */
  static async getStatus(input: { token: string; origin: string; jobId: string }): Promise<
    { ok: true; status: TryOnStatusResult } | { ok: false; reason: 'NOT_FOUND' } | Rejected<StorefrontFailure>
  > {
    const auth = await authorize(input.token, input.origin);
    if (!auth.ok) return auth;

    const status = await TryOnService.getStatusForSession(input.jobId, auth.shop.id, auth.session.sessionId);
    return status ? { ok: true, status } : { ok: false, reason: 'NOT_FOUND' };
  }
}
