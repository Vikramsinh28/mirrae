import { generatePublicKey } from './public-key';

describe('generatePublicKey', () => {
  test('looks like a public key a merchant can paste into a page', () => {
    expect(generatePublicKey()).toMatch(/^pk_live_[0-9a-f]{36}$/);
  });

  test('is different every time', () => {
    const keys = new Set(Array.from({ length: 500 }, () => generatePublicKey()));
    expect(keys.size).toBe(500);
  });
});
