# Shopify: running Mirrae on a development store

What you need first (all free): a Shopify Partner organisation, a development store (for example `mirrae-dev`) and an
app created in the Dev Dashboard. Its **Client ID** is already in `shopify.app.toml`; the **Client secret** goes in
`.env` as `SHOPIFY_API_SECRET` (and the Client ID as `SHOPIFY_API_KEY`). Never paste the secret into a chat or commit it.

## 1. Install the Shopify CLI

```bash
npm install -g @shopify/cli@latest
```

```bash
shopify auth login
```

## 2. Give the app a public https address

Shopify cannot reach `localhost`, and the try-on button on a store page can only load an https script. Use a tunnel
(for example Cloudflare's, `brew install cloudflared`), with the dev server running on port 3000:

```bash
cloudflared tunnel --url http://localhost:3000
```

It prints an address like `https://something.trycloudflare.com` (a new one each time you start it). Then:

1. In `.env` set `NEXT_PUBLIC_APP_URL=https://something.trycloudflare.com` and restart `npm run dev`. The app
   stores this address on the shop so the theme extension knows where to load `widget.js` from.
2. In `shopify.app.toml` replace every `https://mirrae.org` with the same address, for this run only. Put the production address back before committing, and run `shopify app deploy` again with the production address when you are done, because the Shopify app has one set of URLs for everyone.

## 3. Send the configuration and the theme extension to Shopify

```bash
shopify app config link
```

Pick the **Mirrae** app when asked, then:

```bash
shopify app deploy
```

This creates and releases an app version with the URLs, the webhooks (including the three privacy topics) and the
`mirrae-tryon` theme extension. Run it again whenever the tunnel address changes.

## 4. Install on the development store and turn the button on

1. Dev Dashboard, app Mirrae, install it on `mirrae-dev`.
2. Open the app from the store's admin (Apps, Mirrae). The first visit sets the shop up and stores its shop key on the
   app installation (look for `Shopify storefront config sync failed` in the server log if the next step does not work).
3. Online Store, Themes, Customize, App embeds: switch on **Mirrae try-on**, save.
4. Open a product page of the store (add a product with a clothing photo first). A "Try it on" button appears.

If the button does not appear: open the same App embeds panel, expand **Mirrae try-on**, and fill the two settings
under "Advanced" (your shop key `pk_...` and the tunnel address). If it works then, the app metafields are not being
read in Liquid, and that needs fixing (see CLAUDE.md, "Shopify theme extension").
