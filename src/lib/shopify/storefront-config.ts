/**
 * What the theme app extension reads (as app metafields, `app.metafields.mirrae.*`) to put the try-on button on a
 * store without the merchant pasting anything: the shop's public key and the address of the widget script.
 */

export interface StorefrontMetafield {
  namespace: 'mirrae';
  key: 'public_key' | 'widget_url';
  type: 'single_line_text_field';
  value: string;
}

const PUBLIC_KEY = /^pk_[A-Za-z0-9_]+$/;

/** The metafields to store, or null when the app address is not https (a store page cannot load an insecure script) or the key is not a public key. */
export function storefrontMetafields(publicKey: string | undefined, appUrl: string | undefined): StorefrontMetafield[] | null {
  if (!publicKey || !PUBLIC_KEY.test(publicKey) || !appUrl) return null;

  let origin: string;
  try {
    const url = new URL(appUrl);
    if (url.protocol !== 'https:') return null;
    origin = url.origin;
  } catch {
    return null;
  }

  return [
    { namespace: 'mirrae', key: 'public_key', type: 'single_line_text_field', value: publicKey },
    { namespace: 'mirrae', key: 'widget_url', type: 'single_line_text_field', value: `${origin}/widget.js` },
  ];
}
