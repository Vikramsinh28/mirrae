import { createOneTimePurchase, fetchShopProfile, listOneTimePurchases, ShopifyApiError } from './admin';

const CONFIG = { clientId: 'client-id', clientSecret: 'client-secret' };
const SHOP = 'my-store.myshopify.com';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const profileReply = (shop: object) => json(200, { data: { shop } });

function run(fetchImpl: jest.Mock) {
  return fetchShopProfile({ shop: SHOP, sessionToken: 'session.jwt', config: CONFIG, fetchImpl: fetchImpl as unknown as typeof fetch });
}

describe('fetchShopProfile', () => {
  test('exchanges the session token for an online token, then reads the shop', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(json(200, { access_token: 'shpat_online' }))
      .mockResolvedValueOnce(profileReply({ name: 'My Store', email: 'owner@example.com', primaryDomain: { url: 'https://www.example.com' } }));

    const profile = await run(fetchImpl);

    expect(profile).toEqual({ name: 'My Store', contactEmail: 'owner@example.com', primaryOrigin: 'https://www.example.com' });

    const [exchangeUrl, exchangeInit] = fetchImpl.mock.calls[0];
    expect(exchangeUrl).toBe(`https://${SHOP}/admin/oauth/access_token`);
    expect(JSON.parse(exchangeInit.body)).toMatchObject({
      client_id: 'client-id',
      client_secret: 'client-secret',
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: 'session.jwt',
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:online-access-token',
    });

    const [graphqlUrl, graphqlInit] = fetchImpl.mock.calls[1];
    expect(graphqlUrl).toMatch(new RegExp(`^https://${SHOP.replace(/\./g, '\\.')}/admin/api/\\d{4}-\\d{2}/graphql\\.json$`));
    expect(graphqlInit.headers['X-Shopify-Access-Token']).toBe('shpat_online');
  });

  test('keeps only an https primary domain and tolerates a missing email', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(json(200, { access_token: 'shpat_online' }))
      .mockResolvedValueOnce(profileReply({ name: 'My Store', email: null, primaryDomain: { url: 'http://insecure.example.com' } }));

    expect(await run(fetchImpl)).toEqual({ name: 'My Store', contactEmail: null, primaryOrigin: null });
  });

  test('fails with a clear error when Shopify refuses the token exchange', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(json(400, { error: 'invalid_subject_token' }));

    await expect(run(fetchImpl)).rejects.toThrow(ShopifyApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('fails when the exchange answer has no access token', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(json(200, {}));

    await expect(run(fetchImpl)).rejects.toThrow(ShopifyApiError);
  });

  test('fails when the shop query returns GraphQL errors', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(json(200, { access_token: 'shpat_online' }))
      .mockResolvedValueOnce(json(200, { errors: [{ message: 'Access denied' }] }));

    await expect(run(fetchImpl)).rejects.toThrow(ShopifyApiError);
  });

  test('never includes the secret or the tokens in an error message', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(json(400, { error: 'bad', detail: 'client-secret session.jwt' }));

    const error = await run(fetchImpl).catch((caught: Error) => caught);

    expect((error as Error).message).not.toMatch(/client-secret|session\.jwt|shpat_/);
  });
});

describe('one-time purchases', () => {
  const exchange = () => json(200, { access_token: 'shpat_online' });
  const call = (fetchImpl: jest.Mock) => ({ shop: SHOP, sessionToken: 'session.jwt', config: CONFIG, fetchImpl: fetchImpl as unknown as typeof fetch });

  test('creates a purchase and returns its id and the approval page', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(exchange()).mockResolvedValueOnce(
      json(200, {
        data: {
          appPurchaseOneTimeCreate: {
            appPurchaseOneTime: { id: 'gid://shopify/AppPurchaseOneTime/1' },
            confirmationUrl: `https://${SHOP}/admin/charges/1/confirm`,
            userErrors: [],
          },
        },
      })
    );

    const result = await createOneTimePurchase({ ...call(fetchImpl), name: '50 credits', priceUsd: 9, returnUrl: `https://${SHOP}/admin/apps/x`, test: true });

    expect(result).toEqual({ gid: 'gid://shopify/AppPurchaseOneTime/1', confirmationUrl: `https://${SHOP}/admin/charges/1/confirm` });
    const body = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(body.variables).toEqual({ name: '50 credits', price: { amount: 9, currencyCode: 'USD' }, returnUrl: `https://${SHOP}/admin/apps/x`, test: true });
  });

  test('fails when Shopify reports user errors', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(exchange()).mockResolvedValueOnce(
      json(200, { data: { appPurchaseOneTimeCreate: { appPurchaseOneTime: null, confirmationUrl: null, userErrors: [{ message: 'nope' }] } } })
    );

    await expect(createOneTimePurchase({ ...call(fetchImpl), name: 'x', priceUsd: 9, returnUrl: 'https://x.test', test: true })).rejects.toThrow(ShopifyApiError);
  });

  test('lists the latest purchases with their status', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(exchange()).mockResolvedValueOnce(
      json(200, { data: { currentAppInstallation: { oneTimePurchases: { nodes: [{ id: 'gid://a', status: 'ACTIVE' }, { id: 'gid://b', status: 'PENDING' }] } } } })
    );

    expect(await listOneTimePurchases(call(fetchImpl))).toEqual([
      { gid: 'gid://a', status: 'ACTIVE' },
      { gid: 'gid://b', status: 'PENDING' },
    ]);
  });

  test('fails on an unexpected list answer instead of returning an empty list', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(exchange()).mockResolvedValueOnce(json(200, { data: { somethingElse: true } }));

    await expect(listOneTimePurchases(call(fetchImpl))).rejects.toThrow(ShopifyApiError);
  });
});
