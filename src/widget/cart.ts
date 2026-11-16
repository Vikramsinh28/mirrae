/**
 * Finds the store's own "Add to cart" button so the widget can press it for the shopper after a try-on.
 * The widget never talks to a cart API itself: the store's button already knows the chosen size, quantity
 * and theme logic, so pressing it is the safest way to add the item on any platform.
 */

export interface CartButtonLike {
  click(): void;
  disabled?: boolean;
}

export interface CartPageLike {
  querySelector(selector: string): CartButtonLike | null;
}

// Tried in order when the merchant did not set data-cart-button. Shopify's product form first.
const DEFAULT_SELECTORS: readonly string[] = [
  'form[action*="/cart/add"] [type="submit"]',
  'form[action*="/cart/add"] button[name="add"]',
  'button[name="add"]',
  '[data-add-to-cart]',
];

function query(doc: CartPageLike, selector: string): CartButtonLike | null {
  try {
    const found = doc.querySelector(selector);
    return found && !found.disabled ? found : null;
  } catch {
    // A merchant-supplied selector can be invalid; that must never break the page.
    return null;
  }
}

/** A selector the merchant set is trusted alone: no guessing when it matches nothing. */
export function findCartButton(doc: CartPageLike, selector?: string): CartButtonLike | null {
  if (selector) return query(doc, selector);

  for (const candidate of DEFAULT_SELECTORS) {
    const found = query(doc, candidate);
    if (found) return found;
  }
  return null;
}
