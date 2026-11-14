/**
 * Creates (or updates) a storefront shop for local testing and prints its public key.
 *
 *   npx tsx --env-file=.env scripts/create-shop.ts --owner-email you@example.com --name "My Store" \
 *     --domain www.example.com --origin https://www.example.com [--origin http://localhost:3000] \
 *     [--image-host cdn.shopify.com] [--cap 200]
 *
 * The owner's credits pay for every try-on made through the shop. The merchant dashboard will replace this.
 */
import { randomBytes } from 'node:crypto';

import { prisma } from '../src/lib/prisma';

function readArgs(argv: string[]) {
  const values = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) throw new Error(`Bad arguments near "${flag ?? ''}"`);
    values.set(flag.slice(2), [...(values.get(flag.slice(2)) ?? []), value]);
  }
  return values;
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const one = (name: string) => args.get(name)?.[0];

  const ownerEmail = one('owner-email');
  const name = one('name');
  const domain = one('domain');
  const origins = args.get('origin') ?? [];
  if (!ownerEmail || !name || !domain || origins.length === 0) {
    console.error('Required: --owner-email, --name, --domain and at least one --origin');
    process.exit(2);
  }

  const owner = await prisma.user.findFirst({ where: { email: ownerEmail, deletedAt: null }, select: { id: true } });
  if (!owner) {
    console.error(`No user with email ${ownerEmail}`);
    process.exit(1);
  }

  const data = {
    ownerId: owner.id,
    name,
    allowedOrigins: origins,
    imageHosts: args.get('image-host') ?? [],
    dailyTryOnCap: Number(one('cap') ?? 200),
  };
  const existing = await prisma.shop.findUnique({ where: { platform_domain: { platform: 'WEB', domain } } });
  const shop = existing
    ? await prisma.shop.update({ where: { id: existing.id }, data })
    : await prisma.shop.create({ data: { ...data, domain, platform: 'WEB', publicKey: `pk_live_${randomBytes(18).toString('hex')}` } });

  console.log(`${existing ? 'Updated' : 'Created'} shop "${shop.name}" (${shop.id})`);
  console.log(`Public key: ${shop.publicKey}`);
  console.log(`Allowed origins: ${shop.allowedOrigins.join(', ')}`);
  console.log(`Image hosts: ${[...shop.imageHosts, shop.domain].join(', ')}`);
}

main()
  .catch(error => {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
