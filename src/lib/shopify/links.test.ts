import { themeEditorLink } from './links';

describe('themeEditorLink', () => {
  test("opens the store's theme editor with the Mirrae app embed switched on", () => {
    expect(themeEditorLink('my-store.myshopify.com', 'abc123')).toBe(
      'https://my-store.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=abc123%2Fmirrae-tryon'
    );
  });

  test('returns null for an address that is not a myshopify.com store (never build a link to another host)', () => {
    expect(themeEditorLink('evil.com', 'abc123')).toBeNull();
    expect(themeEditorLink('my-store.myshopify.com.evil.com', 'abc123')).toBeNull();
  });
});
