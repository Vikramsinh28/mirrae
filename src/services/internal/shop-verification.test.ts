import { checkDomainRecord } from '@/lib/domain-verification';
import * as repo from '@/services/repositories/shop';
import { ShopVerificationService } from './shop-verification';

jest.mock('@/lib/domain-verification', () => ({
  ...jest.requireActual('@/lib/domain-verification'),
  checkDomainRecord: jest.fn(),
}));
jest.mock('@/services/repositories/shop');

const r = repo as jest.Mocked<typeof repo>;
const dns = checkDomainRecord as jest.Mock;

const OWNER = 7;
const DOMAIN = 'www.example.com';
const shop = { id: 'shop-1', ownerId: OWNER, domain: DOMAIN, platform: 'WEB', verifiedAt: null };
const claimInput = { name: 'My Store', domain: DOMAIN, allowedOrigins: ['https://www.example.com'], imageHosts: [] };

describe('ShopVerificationService', () => {
  const savedSecret = process.env.STOREFRONT_TOKEN_SECRET;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.STOREFRONT_TOKEN_SECRET = 'test-secret-with-enough-length-0123456789';
  });
  afterAll(() => {
    process.env.STOREFRONT_TOKEN_SECRET = savedSecret;
  });

  describe('instructions', () => {
    test("gives the record to add for the merchant's own shop, and whether it is verified yet", async () => {
      r.findShopByIdForOwner.mockResolvedValue(shop as never);

      const result = await ShopVerificationService.instructions(OWNER, 'shop-1');

      expect(result).toMatchObject({ ok: true, verified: false, record: { name: `_mirrae-verification.${DOMAIN}`, value: expect.stringMatching(/^mirrae-verification=[0-9a-f]{32}$/) } });
    });

    test('says NOT_FOUND for someone else\'s shop', async () => {
      r.findShopByIdForOwner.mockResolvedValue(null);

      expect(await ShopVerificationService.instructions(OWNER, 'shop-1')).toEqual({ ok: false, reason: 'NOT_FOUND' });
    });

    test('the record differs per account, so a copied record from another account does not work', async () => {
      r.findShopByIdForOwner.mockResolvedValue(shop as never);
      const mine = await ShopVerificationService.instructions(OWNER, 'shop-1');
      r.findShopByIdForOwner.mockResolvedValue({ ...shop, ownerId: 8 } as never);
      const theirs = await ShopVerificationService.instructions(8, 'shop-1');

      expect(mine.ok && theirs.ok && mine.record.value).not.toBe(theirs.ok && mine.ok && theirs.record.value);
    });
  });

  describe('verify', () => {
    beforeEach(() => r.findShopByIdForOwner.mockResolvedValue(shop as never));

    test('marks the shop verified when the DNS record is there', async () => {
      dns.mockResolvedValue('VERIFIED');

      expect(await ShopVerificationService.verify(OWNER, 'shop-1')).toEqual({ ok: true });
      expect(r.markShopVerified).toHaveBeenCalledWith('shop-1');
    });

    test('checks for the token of this account and website', async () => {
      dns.mockResolvedValue('VERIFIED');

      await ShopVerificationService.verify(OWNER, 'shop-1');

      expect(dns).toHaveBeenCalledWith({ domain: DOMAIN, token: expect.stringMatching(/^[0-9a-f]{32}$/) });
    });

    test('does not check DNS again for a shop that is already verified', async () => {
      r.findShopByIdForOwner.mockResolvedValue({ ...shop, verifiedAt: new Date() } as never);

      expect(await ShopVerificationService.verify(OWNER, 'shop-1')).toEqual({ ok: true });
      expect(dns).not.toHaveBeenCalled();
    });

    test.each([
      ['NOT_FOUND', 'NO_RECORD'],
      ['LOOKUP_FAILED', 'LOOKUP_FAILED'],
    ])('reports DNS answer %s as %s and verifies nothing', async (answer, reason) => {
      dns.mockResolvedValue(answer);

      expect(await ShopVerificationService.verify(OWNER, 'shop-1')).toEqual({ ok: false, reason });
      expect(r.markShopVerified).not.toHaveBeenCalled();
    });

    test('says NOT_FOUND for someone else\'s shop and checks nothing', async () => {
      r.findShopByIdForOwner.mockResolvedValue(null);

      expect(await ShopVerificationService.verify(OWNER, 'shop-1')).toEqual({ ok: false, reason: 'NOT_FOUND' });
      expect(dns).not.toHaveBeenCalled();
    });

    test('never verifies a shop that is not a website shop (Shopify shops are verified by Shopify)', async () => {
      r.findShopByIdForOwner.mockResolvedValue({ ...shop, platform: 'SHOPIFY' } as never);

      expect(await ShopVerificationService.verify(OWNER, 'shop-1')).toEqual({ ok: false, reason: 'NOT_FOUND' });
      expect(dns).not.toHaveBeenCalled();
    });
  });

  describe('claim', () => {
    const holder = { id: 'old-shop', ownerId: 99, platform: 'WEB', domain: DOMAIN, verifiedAt: null };

    beforeEach(() => {
      r.findWebShopByDomain.mockResolvedValue(holder as never);
      r.countShopsByOwner.mockResolvedValue(0);
      dns.mockResolvedValue('VERIFIED');
      r.claimDomainFromUnverifiedShop.mockResolvedValue({ ...shop, id: 'new-shop' } as never);
    });

    test('takes the website over from an account that never proved it, once the merchant proves it', async () => {
      const result = await ShopVerificationService.claim(OWNER, claimInput);

      expect(result).toMatchObject({ ok: true, shop: { id: 'new-shop' } });
      expect(r.claimDomainFromUnverifiedShop).toHaveBeenCalledWith('old-shop', expect.objectContaining({ ownerId: OWNER, platform: 'WEB', domain: DOMAIN }));
    });

    test('does not touch the other account until the proof is in', async () => {
      dns.mockResolvedValue('NOT_FOUND');

      expect(await ShopVerificationService.claim(OWNER, claimInput)).toEqual({ ok: false, reason: 'NO_RECORD' });
      expect(r.claimDomainFromUnverifiedShop).not.toHaveBeenCalled();
    });

    test('cannot take a website from a merchant who already proved it', async () => {
      r.findWebShopByDomain.mockResolvedValue({ ...holder, verifiedAt: new Date() } as never);

      expect(await ShopVerificationService.claim(OWNER, claimInput)).toEqual({ ok: false, reason: 'NOT_CLAIMABLE' });
      expect(dns).not.toHaveBeenCalled();
    });

    test('has nothing to claim when nobody has registered the website', async () => {
      r.findWebShopByDomain.mockResolvedValue(null);

      expect(await ShopVerificationService.claim(OWNER, claimInput)).toEqual({ ok: false, reason: 'NOT_CLAIMABLE' });
    });

    test('cannot claim your own shop (verify it instead)', async () => {
      r.findWebShopByDomain.mockResolvedValue({ ...holder, ownerId: OWNER } as never);

      expect(await ShopVerificationService.claim(OWNER, claimInput)).toEqual({ ok: false, reason: 'NOT_CLAIMABLE' });
    });

    test('respects the shop limit', async () => {
      r.countShopsByOwner.mockResolvedValue(5);

      expect(await ShopVerificationService.claim(OWNER, claimInput)).toEqual({ ok: false, reason: 'LIMIT_REACHED' });
      expect(r.claimDomainFromUnverifiedShop).not.toHaveBeenCalled();
    });

    test('loses gracefully when the holder proved the website a moment earlier', async () => {
      r.claimDomainFromUnverifiedShop.mockResolvedValue(null);

      expect(await ShopVerificationService.claim(OWNER, claimInput)).toEqual({ ok: false, reason: 'NOT_CLAIMABLE' });
    });
  });

  describe('claimInstructions', () => {
    test('gives the record for the merchant and the website, without needing a shop yet', async () => {
      const result = await ShopVerificationService.claimInstructions(OWNER, DOMAIN);

      expect(result.record.name).toBe(`_mirrae-verification.${DOMAIN}`);
    });
  });
});
