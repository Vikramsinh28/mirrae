import { prisma } from '@/lib/prisma';

export const findShopByPublicKey = (publicKey: string) => prisma.shop.findUnique({ where: { publicKey } });

export const findShopById = (id: string) => prisma.shop.findUnique({ where: { id } });

/** Try-ons started for a shop since a moment (used for the shop's daily cap). */
export const countShopJobsSince = (shopId: string, since: Date) =>
  prisma.tryOnJob.count({ where: { shopId, createdAt: { gte: since } } });
