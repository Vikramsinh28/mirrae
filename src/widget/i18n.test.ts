import { directionOf, errorText, LOCALES, resolveLocale, STRINGS } from './i18n';

describe('resolveLocale', () => {
  test.each([
    ['hi', undefined, 'hi'],
    ['ar', 'en', 'ar'],
    ['HI-IN', undefined, 'hi'],
    [undefined, 'hi-IN', 'hi'],
    [undefined, 'ar_AE', 'ar'],
    [undefined, 'en-GB', 'en'],
    ['xx', 'hi', 'hi'],
    ['xx', 'yy', 'en'],
    [undefined, undefined, 'en'],
    ['', '', 'en'],
  ])('merchant %p, page %p resolves to %s (explicit choice wins, then the page language, else English)', (requested, page, expected) => {
    expect(resolveLocale(requested, page)).toBe(expected);
  });
});

describe('strings', () => {
  const english = STRINGS.en;

  test.each(LOCALES)('%s has exactly the same keys as English, none empty', locale => {
    const strings = STRINGS[locale];
    expect(Object.keys(strings).sort()).toEqual(Object.keys(english).sort());
    Object.entries(strings).forEach(([key, value]) => {
      if (typeof value === 'string') expect(value.trim()).not.toBe('');
      else Object.values(value).forEach(inner => expect(String(inner).trim()).not.toBe(''));
      expect(key).toBeTruthy();
    });
  });

  test.each(LOCALES)('%s translates every error code that English does', locale => {
    expect(Object.keys(STRINGS[locale].errors).sort()).toEqual(Object.keys(english.errors).sort());
  });

  test('Arabic is right-to-left, the others left-to-right', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('hi')).toBe('ltr');
  });
});

describe('errorText', () => {
  const strings = STRINGS.en;

  test('says what is wrong with the photo, using the problem the server found', () => {
    expect(errorText(strings, { code: 'PHOTO_PROBLEM', problem: 'NO_PERSON' })).toBe(strings.errors.NO_PERSON);
    expect(errorText(strings, { code: 'PHOTO_PROBLEM', problem: 'MULTIPLE_PEOPLE' })).toBe(strings.errors.MULTIPLE_PEOPLE);
    expect(errorText(strings, { code: 'PHOTO_PROBLEM', problem: 'PERSON_TOO_SMALL' })).toBe(strings.errors.PERSON_TOO_SMALL);
  });

  test('asks the shopper to wait the number of seconds the server asked for', () => {
    expect(errorText(strings, { code: 'RATE_LIMITED', retryAfterMs: 4200 })).toContain('5');
  });

  test.each(['ORIGIN_NOT_ALLOWED', 'UNKNOWN_SHOP', 'SHOP_INACTIVE', 'DAILY_CAP_REACHED', 'INSUFFICIENT_CREDITS'])(
    'shows only "unavailable" for %s: shoppers never learn about merchant configuration or billing',
    code => {
      const text = errorText(strings, { code });
      expect(text).toBe(strings.errors.UNAVAILABLE);
      expect(text).not.toMatch(/credit|cap|origin|key|billing/i);
    }
  );

  test('falls back to a generic message for a code it does not know', () => {
    expect(errorText(strings, { code: 'SOMETHING_NEW' })).toBe(strings.errors.GENERIC);
  });

  test('has a message for a lost connection', () => {
    expect(errorText(strings, { code: 'NETWORK' })).toBe(strings.errors.NETWORK);
  });
});
