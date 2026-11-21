import { HOST_TAG } from './host';

describe('HOST_TAG', () => {
  // A host <div> with nothing but a shadow root is "empty" to the page's CSS: Shopify's default theme (Dawn) has
  // `div:empty { display: none }`, which hid the whole widget. A custom element (its name must contain a hyphen)
  // is not matched by rules written for div, a, p, section and the like.
  test('is a valid custom element name, so theme rules for plain tags never hide the widget', () => {
    expect(HOST_TAG).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/);
  });

  test('is not one of the plain tags themes style, such as div', () => {
    expect(['div', 'span', 'section', 'p', 'a']).not.toContain(HOST_TAG);
  });
});
