import { candidateRecordNames, checkDomainRecord, domainVerificationToken, verificationRecord } from './domain-verification';

const SECRET = 'test-secret-with-enough-length-0123456789';

describe('domainVerificationToken', () => {
  test('is stable for the same account and website', () => {
    expect(domainVerificationToken(7, 'www.example.com', SECRET)).toBe(domainVerificationToken(7, 'www.example.com', SECRET));
  });

  test('differs per account, so reading someone else\'s public DNS record proves nothing', () => {
    expect(domainVerificationToken(7, 'www.example.com', SECRET)).not.toBe(domainVerificationToken(8, 'www.example.com', SECRET));
  });

  test('differs per website and ignores letter case', () => {
    expect(domainVerificationToken(7, 'a.example.com', SECRET)).not.toBe(domainVerificationToken(7, 'b.example.com', SECRET));
    expect(domainVerificationToken(7, 'WWW.Example.com', SECRET)).toBe(domainVerificationToken(7, 'www.example.com', SECRET));
  });

  test('cannot be worked out without the secret', () => {
    expect(domainVerificationToken(7, 'www.example.com', SECRET)).not.toBe(domainVerificationToken(7, 'www.example.com', `${SECRET}x`));
  });

  test('is a short, DNS-safe string', () => {
    expect(domainVerificationToken(7, 'www.example.com', SECRET)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('verificationRecord', () => {
  test('names the TXT record to add and the value it must have', () => {
    expect(verificationRecord('www.example.com', 'abc')).toEqual({ name: '_mirrae-verification.www.example.com', value: 'mirrae-verification=abc' });
  });
});

describe('candidateRecordNames', () => {
  test('looks at the website itself, and at the address without www for a www website', () => {
    expect(candidateRecordNames('www.example.com')).toEqual(['_mirrae-verification.www.example.com', '_mirrae-verification.example.com']);
    expect(candidateRecordNames('shop.example.com')).toEqual(['_mirrae-verification.shop.example.com']);
  });
});

describe('checkDomainRecord', () => {
  const DOMAIN = 'www.example.com';
  const VALUE = 'mirrae-verification=tok123';

  test('is verified when the record carries the exact value', async () => {
    const resolveTxt = jest.fn().mockResolvedValue([['unrelated'], [VALUE]]);

    expect(await checkDomainRecord({ domain: DOMAIN, token: 'tok123', resolveTxt })).toBe('VERIFIED');
    expect(resolveTxt).toHaveBeenCalledWith('_mirrae-verification.www.example.com');
  });

  test('puts back together a value the DNS server split into chunks', async () => {
    const resolveTxt = jest.fn().mockResolvedValue([['mirrae-verification=', 'tok123']]);

    expect(await checkDomainRecord({ domain: DOMAIN, token: 'tok123', resolveTxt })).toBe('VERIFIED');
  });

  test('accepts the record on the address without www', async () => {
    const resolveTxt = jest.fn().mockImplementation(async (name: string) => {
      if (name === '_mirrae-verification.example.com') return [[VALUE]];
      throw Object.assign(new Error('nope'), { code: 'ENOTFOUND' });
    });

    expect(await checkDomainRecord({ domain: DOMAIN, token: 'tok123', resolveTxt })).toBe('VERIFIED');
  });

  test.each([['mirrae-verification=other'], ['mirrae-verification=tok123 '], ['xmirrae-verification=tok123'], ['tok123']])(
    'is not verified by a record that is not exactly the value: %p',
    async text => {
      const resolveTxt = jest.fn().mockResolvedValue([[text]]);

      expect(await checkDomainRecord({ domain: DOMAIN, token: 'tok123', resolveTxt })).toBe('NOT_FOUND');
    }
  );

  test.each(['ENOTFOUND', 'ENODATA'])('says NOT_FOUND when the record does not exist (%s)', async code => {
    const resolveTxt = jest.fn().mockRejectedValue(Object.assign(new Error('x'), { code }));

    expect(await checkDomainRecord({ domain: DOMAIN, token: 'tok123', resolveTxt })).toBe('NOT_FOUND');
  });

  test('says LOOKUP_FAILED when DNS itself failed, so the merchant is told to retry instead of that the record is missing', async () => {
    const resolveTxt = jest.fn().mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }));

    expect(await checkDomainRecord({ domain: DOMAIN, token: 'tok123', resolveTxt })).toBe('LOOKUP_FAILED');
  });

  test('never verifies with an empty token', async () => {
    const resolveTxt = jest.fn().mockResolvedValue([['mirrae-verification=']]);

    expect(await checkDomainRecord({ domain: DOMAIN, token: '', resolveTxt })).toBe('NOT_FOUND');
  });
});
