import { findCartButton, type CartButtonLike, type CartPageLike } from './cart';

const button = (): CartButtonLike => ({ click: jest.fn(), disabled: false });

/** A fake page that answers only the selectors it was given. */
const page = (matches: Record<string, CartButtonLike>): CartPageLike => ({
  querySelector: selector => matches[selector] ?? null,
});

describe('findCartButton', () => {
  test('uses the merchant\'s own selector when it matches', () => {
    const own = button();

    expect(findCartButton(page({ '#buy-now': own }), '#buy-now')).toBe(own);
  });

  test('does not fall back to a guess when the merchant named a selector that matches nothing', () => {
    const guess = button();

    expect(findCartButton(page({ 'form[action*="/cart/add"] [type="submit"]': guess }), '#missing')).toBeNull();
  });

  test('finds the standard Shopify add-to-cart button when no selector is given', () => {
    const shopify = button();

    expect(findCartButton(page({ 'form[action*="/cart/add"] [type="submit"]': shopify }))).toBe(shopify);
  });

  test('returns null on a page with no recognisable add-to-cart button', () => {
    expect(findCartButton(page({}))).toBeNull();
  });

  test('ignores a disabled button, such as a sold-out product', () => {
    const soldOut: CartButtonLike = { click: jest.fn(), disabled: true };

    expect(findCartButton(page({ '#buy-now': soldOut }), '#buy-now')).toBeNull();
  });

  test('survives an invalid selector from the merchant', () => {
    const throwing: CartPageLike = {
      querySelector: () => {
        throw new SyntaxError('bad selector');
      },
    };

    expect(findCartButton(throwing, '###')).toBeNull();
  });
});
