import { checkDomainRecord, domainVerificationToken, verificationRecord } from '@/lib/domain-verification';
import { generatePublicKey } from '@/lib/storefront/public-key';
import { getSecret } from '@/lib/storefront/token';
import * as repo from '@/services/repositories/shop';
import type { CreateShopInput } from '@/validations/shop';

import { MAX_SHOPS_PER_OWNER, type ShopView } from './shop';

/**
 * Proving that a merchant owns a website (a DNS TXT record), so nobody can serve shoppers on, or squat on, a
 * website that is not theirs. Shopify shops never come through here: Shopify has already verified the store.
 */

export interface VerificationRecord {
  name: string;
  value: string;
}

export type VerifyFailure = 'NO_RECORD' | 'LOOKUP_FAILED';

const recordFor = (ownerId: number, domain: string): VerificationRecord =>
  verificationRecord(domain, domainVerificationToken(ownerId, domain, getSecret()));

async function checkRecord(ownerId: number, domain: string): Promise<{ ok: true } | { ok: false; reason: VerifyFailure }> {
  const answer = await checkDomainRecord({ domain, token: domainVerificationToken(ownerId, domain, getSecret()) });
  if (answer === 'VERIFIED') return { ok: true };
  return { ok: false, reason: answer === 'LOOKUP_FAILED' ? 'LOOKUP_FAILED' : 'NO_RECORD' };
}

const toView = ({ ownerId: _ownerId, ...shop }: NonNullable<Awaited<ReturnType<typeof repo.findShopById>>>): ShopView => shop;

export class ShopVerificationService {
  /** What the merchant has to add to their DNS, and whether the shop is verified already. */
  static async instructions(
    ownerId: number,
    shopId: string
  ): Promise<{ ok: true; verified: boolean; record: VerificationRecord } | { ok: false; reason: 'NOT_FOUND' }> {
    const shop = await repo.findShopByIdForOwner(shopId, ownerId);
    if (!shop || shop.platform !== 'WEB') return { ok: false, reason: 'NOT_FOUND' };

    return { ok: true, verified: shop.verifiedAt !== null, record: recordFor(ownerId, shop.domain) };
  }

  static async verify(ownerId: number, shopId: string): Promise<{ ok: true } | { ok: false; reason: 'NOT_FOUND' | VerifyFailure }> {
    const shop = await repo.findShopByIdForOwner(shopId, ownerId);
    if (!shop || shop.platform !== 'WEB') return { ok: false, reason: 'NOT_FOUND' };
    if (shop.verifiedAt !== null) return { ok: true };

    const checked = await checkRecord(ownerId, shop.domain);
    if (!checked.ok) return checked;

    await repo.markShopVerified(shop.id);
    return { ok: true };
  }

  /** The record for taking over a website another account registered, before any shop exists for this merchant. */
  static async claimInstructions(ownerId: number, domain: string): Promise<{ record: VerificationRecord }> {
    return { record: recordFor(ownerId, domain) };
  }

  /**
   * Takes a website over from an account that registered it without proving it owns it. Nothing about the other
   * account changes until the DNS record is found; then its unverified shop is replaced by the merchant's own,
   * already verified one.
   */
  static async claim(
    ownerId: number,
    input: CreateShopInput
  ): Promise<{ ok: true; shop: ShopView } | { ok: false; reason: 'NOT_CLAIMABLE' | 'LIMIT_REACHED' | VerifyFailure }> {
    const holder = await repo.findWebShopByDomain(input.domain);
    if (!holder || holder.verifiedAt !== null || holder.ownerId === ownerId) return { ok: false, reason: 'NOT_CLAIMABLE' };

    if ((await repo.countShopsByOwner(ownerId)) >= MAX_SHOPS_PER_OWNER) return { ok: false, reason: 'LIMIT_REACHED' };

    const checked = await checkRecord(ownerId, input.domain);
    if (!checked.ok) return checked;

    const created = await repo.claimDomainFromUnverifiedShop(holder.id, {
      ownerId,
      name: input.name,
      platform: 'WEB',
      domain: input.domain,
      publicKey: generatePublicKey(),
      allowedOrigins: input.allowedOrigins,
      imageHosts: input.imageHosts,
    });
    // The holder proved the website between our look and the swap: it is theirs now
    return created ? { ok: true, shop: toView(created) } : { ok: false, reason: 'NOT_CLAIMABLE' };
  }
}
