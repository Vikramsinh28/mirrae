/**
 * The element that holds the widget's shadow root. Never a plain <div>: with all the content inside the shadow root
 * the div is "empty" to the page's CSS, and themes commonly hide those (Shopify's Dawn has `div:empty { display: none }`).
 * A custom element name (it must contain a hyphen) is not matched by rules written for ordinary tags.
 */
export const HOST_TAG = 'mirrae-widget';
