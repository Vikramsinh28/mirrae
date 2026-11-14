import { putObject } from '@/services/external/aws/s3';
import { findPersonProblem } from '@/services/external/tryon-check';
import { fetchProductImage, ProductImageError } from '@/lib/security/product-image';
import { storefrontLimits } from '@/lib/storefront/limits';
import { verifyStorefrontToken } from '@/lib/storefront/token';
import * as shopRepo from '@/services/repositories/shop';
import { StorefrontService } from './storefront';
import { TryOnService } from './tryon';
import { prepareTryOnImage } from './tryon-image';

jest.mock('@/services/external/aws/s3');
jest.mock('@/services/external/tryon-check', () => ({ findPersonProblem: jest.fn() }));
jest.mock('@/lib/security/product-image', () => ({
  fetchProductImage: jest.fn(),
  ProductImageError: class extends Error {},
}));
jest.mock('@/lib/storefront/limits', () => {
  const allow = () => ({ check: jest.fn().mockReturnValue({ allowed: true, remaining: 1, retryAfterMs: 0 }), size: () => 0 });
  return {
    storefrontLimits: {
      sessionByIp: allow(),
      photoBySession: allow(),
      photoByIp: allow(),
      tryOnBySession: allow(),
      tryOnByIp: allow(),
    },
  };
});
jest.mock('@/services/repositories/shop');
jest.mock('./tryon', () => ({
  TryOnService: { createJob: jest.fn(), processJob: jest.fn(), getStatusForSession: jest.fn() },
  PHOTO_PROBLEM_MESSAGES: { NO_PERSON: 'We could not find a person in your photo.' },
}));
jest.mock('./tryon-image', () => ({
  prepareTryOnImage: jest.fn(),
  TryOnImageError: class extends Error {},
}));

const shops = shopRepo as jest.Mocked<typeof shopRepo>;
const tryOn = TryOnService as jest.Mocked<typeof TryOnService>;
const limits = storefrontLimits as unknown as Record<string, { check: jest.Mock }>;

const ORIGIN = 'https://www.example.com';
const IP = '203.0.113.9';
const shop = {
  id: '8a1f0c52-1111-4222-8333-444455556666',
  ownerId: 7,
  name: 'Example Store',
  domain: 'www.example.com',
  publicKey: 'pk_live_abc',
  allowedOrigins: [ORIGIN],
  imageHosts: ['cdn.shopify.com'],
  status: 'ACTIVE',
  dailyTryOnCap: 200,
};

const open = async () => {
  const result = await StorefrontService.openSession({ publicKey: shop.publicKey, origin: ORIGIN, ip: IP });
  if (!result.ok) throw new Error('could not open session');
  return result;
};

describe('StorefrontService', () => {
  const originalSecret = process.env.STOREFRONT_TOKEN_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STOREFRONT_TOKEN_SECRET = 'test-storefront-secret-with-enough-length-0123456789';
    Object.values(limits).forEach(limiter => limiter.check.mockReturnValue({ allowed: true, remaining: 1, retryAfterMs: 0 }));
    shops.findShopByPublicKey.mockResolvedValue(shop as never);
    shops.findShopById.mockResolvedValue(shop as never);
    shops.countShopJobsSince.mockResolvedValue(0);
    (prepareTryOnImage as jest.Mock).mockResolvedValue({ base64: Buffer.from([9, 9]).toString('base64'), contentType: 'image/jpeg' });
    (findPersonProblem as jest.Mock).mockResolvedValue(null);
    (putObject as jest.Mock).mockImplementation(async (purpose: string) => ({ key: `key-for-${purpose}`, bucket: 'b' }));
    (fetchProductImage as jest.Mock).mockResolvedValue({ bytes: new Uint8Array([1]), contentType: 'image/png' });
    tryOn.createJob.mockResolvedValue({ ok: true, jobId: 'job-1' });
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.STOREFRONT_TOKEN_SECRET;
    else process.env.STOREFRONT_TOKEN_SECRET = originalSecret;
  });

  describe('openSession', () => {
    test('opens a session for an allowed origin and returns a token bound to this shop', async () => {
      const result = await open();

      expect(result.shopName).toBe('Example Store');
      expect(verifyStorefrontToken(result.token)).toMatchObject({ shopId: shop.id });
      expect(verifyStorefrontToken(result.token)?.sessionId).toEqual(expect.any(String));
    });

    test('gives every session its own id', async () => {
      const first = verifyStorefrontToken((await open()).token);
      const second = verifyStorefrontToken((await open()).token);

      expect(first?.sessionId).not.toBe(second?.sessionId);
    });

    test.each([
      ['an unknown public key', () => shops.findShopByPublicKey.mockResolvedValue(null), 'UNKNOWN_SHOP'],
      ['a suspended shop', () => shops.findShopByPublicKey.mockResolvedValue({ ...shop, status: 'SUSPENDED' } as never), 'SHOP_INACTIVE'],
      ['an uninstalled shop', () => shops.findShopByPublicKey.mockResolvedValue({ ...shop, status: 'UNINSTALLED' } as never), 'SHOP_INACTIVE'],
    ])('refuses %s', async (_name, arrange, reason) => {
      arrange();
      await expect(StorefrontService.openSession({ publicKey: 'pk', origin: ORIGIN, ip: IP })).resolves.toMatchObject({ ok: false, reason });
    });

    test.each(['https://evil.example.org', 'http://www.example.com', 'https://www.example.com.evil.net', ''])(
      'refuses the origin %p that is not on the shop list',
      async origin => {
        await expect(StorefrontService.openSession({ publicKey: shop.publicKey, origin, ip: IP })).resolves.toMatchObject({
          ok: false,
          reason: 'ORIGIN_NOT_ALLOWED',
        });
      }
    );

    test('is rate limited per IP', async () => {
      limits.sessionByIp.check.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 5000 });

      await expect(StorefrontService.openSession({ publicKey: shop.publicKey, origin: ORIGIN, ip: IP })).resolves.toMatchObject({
        ok: false,
        reason: 'RATE_LIMITED',
        retryAfterMs: 5000,
      });
      expect(shops.findShopByPublicKey).not.toHaveBeenCalled();
    });
  });

  describe('token checks on every other call', () => {
    test('rejects a forged token', async () => {
      await expect(
        StorefrontService.uploadPhoto({ token: 'forged.token', origin: ORIGIN, ip: IP, bytes: new Uint8Array([1]) })
      ).resolves.toMatchObject({ ok: false, reason: 'INVALID_TOKEN' });
    });

    test('rejects a token whose shop no longer exists', async () => {
      const { token } = await open();
      shops.findShopById.mockResolvedValue(null);

      await expect(StorefrontService.getStatus({ token, origin: ORIGIN, jobId: 'job-1' })).resolves.toMatchObject({
        ok: false,
        reason: 'INVALID_TOKEN',
      });
    });

    test('rejects the same token used from another origin', async () => {
      const { token } = await open();

      await expect(
        StorefrontService.getStatus({ token, origin: 'https://evil.example.org', jobId: 'job-1' })
      ).resolves.toMatchObject({ ok: false, reason: 'ORIGIN_NOT_ALLOWED' });
    });

    test('stops a session as soon as the shop is suspended', async () => {
      const { token } = await open();
      shops.findShopById.mockResolvedValue({ ...shop, status: 'SUSPENDED' } as never);

      await expect(StorefrontService.getStatus({ token, origin: ORIGIN, jobId: 'job-1' })).resolves.toMatchObject({
        ok: false,
        reason: 'SHOP_INACTIVE',
      });
    });
  });

  describe('uploadPhoto', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    test('stores the cleaned photo under this shop and session and returns its key', async () => {
      const { token } = await open();
      const sessionId = verifyStorefrontToken(token)?.sessionId;

      const result = await StorefrontService.uploadPhoto({ token, origin: ORIGIN, ip: IP, bytes });

      expect(result).toEqual({ ok: true, photoKey: 'key-for-TryOnPerson' });
      expect(putObject).toHaveBeenCalledWith('TryOnPerson', shop.id, sessionId, 'image/jpeg', expect.any(Uint8Array));
    });

    test('tells the shopper at once when the photo has a problem, and stores nothing', async () => {
      const { token } = await open();
      (findPersonProblem as jest.Mock).mockResolvedValue('NO_PERSON');

      const result = await StorefrontService.uploadPhoto({ token, origin: ORIGIN, ip: IP, bytes });

      expect(result).toEqual({ ok: false, reason: 'PHOTO_PROBLEM', problem: 'NO_PERSON', message: expect.any(String) });
      expect(putObject).not.toHaveBeenCalled();
    });

    test('refuses bytes that are not an image', async () => {
      const { token } = await open();
      (prepareTryOnImage as jest.Mock).mockRejectedValue(new Error('not an image'));

      await expect(StorefrontService.uploadPhoto({ token, origin: ORIGIN, ip: IP, bytes })).resolves.toMatchObject({
        ok: false,
        reason: 'INVALID_PHOTO',
      });
      expect(putObject).not.toHaveBeenCalled();
    });

    test.each([['empty', new Uint8Array(0)], ['over 8 MB', new Uint8Array(8 * 1024 * 1024 + 1)]])(
      'refuses a photo that is %s before decoding it',
      async (_name, big) => {
        const { token } = await open();

        await expect(StorefrontService.uploadPhoto({ token, origin: ORIGIN, ip: IP, bytes: big })).resolves.toMatchObject({
          ok: false,
          reason: 'INVALID_PHOTO',
        });
        expect(prepareTryOnImage).not.toHaveBeenCalled();
      }
    );

    test('is rate limited per session and per IP before any work is done', async () => {
      const { token } = await open();
      limits.photoBySession.check.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });

      await expect(StorefrontService.uploadPhoto({ token, origin: ORIGIN, ip: IP, bytes })).resolves.toMatchObject({
        ok: false,
        reason: 'RATE_LIMITED',
      });
      expect(prepareTryOnImage).not.toHaveBeenCalled();

      limits.photoBySession.check.mockReturnValue({ allowed: true, remaining: 1, retryAfterMs: 0 });
      limits.photoByIp.check.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
      await expect(StorefrontService.uploadPhoto({ token, origin: ORIGIN, ip: IP, bytes })).resolves.toMatchObject({
        ok: false,
        reason: 'RATE_LIMITED',
      });
    });
  });

  describe('startTryOn', () => {
    const request = (token: string, overrides: object = {}) => ({
      token,
      origin: ORIGIN,
      ip: IP,
      photoKey: 'tryon/person/x/y/1.jpg',
      productImageUrl: 'https://cdn.shopify.com/p.png',
      views: 'multi' as const,
      consent: true,
      ...overrides,
    });

    test('downloads the product image safely, stores it for this session and starts a job paid by the shop owner', async () => {
      const { token } = await open();
      const sessionId = verifyStorefrontToken(token)?.sessionId;

      const result = await StorefrontService.startTryOn(request(token));

      expect(result).toEqual({ ok: true, jobId: 'job-1' });
      expect(fetchProductImage).toHaveBeenCalledWith('https://cdn.shopify.com/p.png', {
        allowedHosts: ['cdn.shopify.com', 'www.example.com'],
      });
      expect(putObject).toHaveBeenCalledWith('TryOnProduct', shop.id, sessionId, 'image/png', expect.any(Uint8Array));
      expect(tryOn.createJob).toHaveBeenCalledWith({
        userId: shop.ownerId,
        personImageKey: 'tryon/person/x/y/1.jpg',
        productImageKey: 'key-for-TryOnProduct',
        consent: true,
        views: 'multi',
        storefront: { shopId: shop.id, sessionId },
      });
    });

    test('stops at the shop daily cap without touching the product url or creating a job', async () => {
      const { token } = await open();
      shops.countShopJobsSince.mockResolvedValue(200);

      await expect(StorefrontService.startTryOn(request(token))).resolves.toMatchObject({
        ok: false,
        reason: 'DAILY_CAP_REACHED',
      });
      expect(fetchProductImage).not.toHaveBeenCalled();
      expect(tryOn.createJob).not.toHaveBeenCalled();
    });

    test('counts the cap from the start of the current UTC day', async () => {
      const { token } = await open();

      await StorefrontService.startTryOn(request(token));

      const since = shops.countShopJobsSince.mock.calls[0][1];
      expect([since.getUTCHours(), since.getUTCMinutes(), since.getUTCSeconds()]).toEqual([0, 0, 0]);
    });

    test('refuses a product image that fails the safety rules', async () => {
      const { token } = await open();
      (fetchProductImage as jest.Mock).mockRejectedValue(new ProductImageError('host not allowed'));

      await expect(StorefrontService.startTryOn(request(token))).resolves.toMatchObject({
        ok: false,
        reason: 'INVALID_PRODUCT_IMAGE',
      });
      expect(tryOn.createJob).not.toHaveBeenCalled();
    });

    test.each([
      ['INSUFFICIENT_CREDITS', 'INSUFFICIENT_CREDITS'],
      ['CONSENT_REQUIRED', 'CONSENT_REQUIRED'],
      ['INVALID_KEY', 'INVALID_PHOTO'],
    ])('maps the service result %s to %s', async (serviceReason, expected) => {
      const { token } = await open();
      tryOn.createJob.mockResolvedValue({ ok: false, reason: serviceReason as never });

      await expect(StorefrontService.startTryOn(request(token))).resolves.toMatchObject({ ok: false, reason: expected });
    });

    test('is rate limited per session and per IP', async () => {
      const { token } = await open();
      limits.tryOnBySession.check.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
      await expect(StorefrontService.startTryOn(request(token))).resolves.toMatchObject({ ok: false, reason: 'RATE_LIMITED' });

      limits.tryOnBySession.check.mockReturnValue({ allowed: true, remaining: 1, retryAfterMs: 0 });
      limits.tryOnByIp.check.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
      await expect(StorefrontService.startTryOn(request(token))).resolves.toMatchObject({ ok: false, reason: 'RATE_LIMITED' });
      expect(tryOn.createJob).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    test("returns the status of this session's own job", async () => {
      const { token } = await open();
      const sessionId = verifyStorefrontToken(token)?.sessionId;
      tryOn.getStatusForSession.mockResolvedValue({ status: 'processing' });

      const result = await StorefrontService.getStatus({ token, origin: ORIGIN, jobId: 'job-1' });

      expect(result).toEqual({ ok: true, status: { status: 'processing' } });
      expect(tryOn.getStatusForSession).toHaveBeenCalledWith('job-1', shop.id, sessionId);
    });

    test('reports NOT_FOUND for a job from another session', async () => {
      const { token } = await open();
      tryOn.getStatusForSession.mockResolvedValue(null);

      await expect(StorefrontService.getStatus({ token, origin: ORIGIN, jobId: 'job-9' })).resolves.toMatchObject({
        ok: false,
        reason: 'NOT_FOUND',
      });
    });
  });
});
