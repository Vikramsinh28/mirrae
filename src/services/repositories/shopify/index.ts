import { randomBytes } from 'node:crypto';

import { DEFAULT_INITIAL_CREDITS } from '@/lib/constants/credits';
import { prisma } from '@/lib/prisma';

/** Data access for shops that came from the Shopify App Store. A Shopify shop's address is its myshopify.com host. */

const PLATFORM = 'SHOPIFY' as const;

export const findShopifyShop = (domain: string) =>
  prisma.shop.findUnique({ where: { platform_domain: { platform: PLATFORM, domain } } });

export interface NewShopifyShop {
  domain: string;
  name: string;
  contactEmail: string | null;
  publicKey: string;
  allowedOrigins: string[];
  imageHosts: string[];
}

/**
 * Creates the shop together with the account that owns it and pays for its try-ons. The account gets a made-up
 * address on the reserved .invalid domain on purpose: the store contact email is self-asserted, so using it
 * to find or create a Mirrae account would let anyone attach their shop to someone else's credits.
 */
export const createShopifyShopWithOwner = (data: NewShopifyShop) =>
  prisma.$transaction(async tx => {
    const owner = await tx.user.create({
      data: {
        name: data.name,
        email: `shopify-${data.domain.replace(/\.myshopify\.com$/, '')}-${randomBytes(4).toString('hex')}@shops.invalid`,
        role: 'USER',
        isOnboarded: true,
        credits: DEFAULT_INITIAL_CREDITS,
        plan: 'FREE',
      },
    });
    return tx.shop.create({
      data: {
        ownerId: owner.id,
        platform: PLATFORM,
        name: data.name,
        domain: data.domain,
        contactEmail: data.contactEmail,
        publicKey: data.publicKey,
        allowedOrigins: data.allowedOrigins,
        imageHosts: data.imageHosts,
        // Shopify has already verified the store, so there is nothing for the merchant to prove
        verifiedAt: new Date(),
      },
    });
  });

/** A returning merchant: back to ACTIVE with fresh details, keeping the public key (the code on their site still works). */
export const reactivateShopifyShop = (id: string, data: { name: string; contactEmail: string | null; allowedOrigins: string[] }) =>
  prisma.shop.update({ where: { id }, data: { ...data, status: 'ACTIVE', uninstalledAt: null } });

export const markShopifyShopUninstalled = (domain: string) =>
  prisma.shop.updateMany({
    where: { platform: PLATFORM, domain, status: { not: 'UNINSTALLED' } },
    data: { status: 'UNINSTALLED', uninstalledAt: new Date() },
  });

/** Shopify asks for a store's data to be erased 48 hours after uninstall: the shop goes (and its events with it); its owner account is closed. */
export async function eraseShopifyShop(domain: string): Promise<void> {
  const shop = await findShopifyShop(domain);
  if (!shop) return;

  await prisma.$transaction([
    prisma.shop.delete({ where: { id: shop.id } }),
    prisma.user.update({ where: { id: shop.ownerId }, data: { deletedAt: new Date() } }),
  ]);
}
