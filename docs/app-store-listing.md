# Shopify App Store listing and review notes (draft)

Written 2026-11-22. Every claim below is something the app does today (checked against `CLAUDE.md` and the dev-store runs). The field names and length limits are from memory of the Partner Dashboard form: **check each limit in the Dev Dashboard before pasting**. Nothing here has been submitted.

## 1. Listing copy

**App name** (aim for 30 characters or fewer): `Mirrae: Virtual Try-On`

**App introduction / tagline** (aim for 100 or fewer): 
`Shoppers see your clothes on themselves in about 30 seconds: front, side and back views.`

**App details** (aim for 500 or fewer):

> Add a "Try it on" button to your product pages. A shopper uploads a photo, ticks a consent box, and sees themselves wearing the product from the front, side and back. Photos are deleted as soon as the front view is ready. Turn it on with one switch in the theme editor: no code, no theme changes. See how many shoppers tried, viewed a result, added to cart or shared, per store and per day. Pay only for finished try-ons with credit packs; new stores get 5 free credits.

**Feature list** (short lines; each 80 characters or fewer):

1. `Front, side and back views from one photo`
2. `One-switch install through the theme app embed`
3. `Photo deleted right after the front view`
4. `Add to cart and share from the result`
5. `English, Hindi and Arabic (right to left)`
6. `Funnel stats: opened, saw result, added to cart`
7. `Daily cap and low-credit warnings you control`

**Search terms:** virtual try on, fitting room, try on clothes, AI try on, clothing preview, apparel.

**Pricing section:** Free to install. You pay for finished try-ons with credit packs bought through Shopify Billing. A front-view try-on uses 1 credit; front, side and back uses 2. A failed try-on is not charged. Packs: 50 credits for $9, 200 for $34, 1,000 for $149 (prices as set in `src/lib/shopify/billing.ts`). New stores start with 5 free credits.

**Support:** connect@mirrae.org. Shopify recommends listing a phone number as well: **decide which number to publish** (not decided).

**URLs:** privacy policy `https://mirrae.org/privacy-policy`, terms `https://mirrae.org/terms-of-services` (both live as draft v0.1 pending a lawyer's review).

**Honest limits to keep in the copy** (do not remove): results are AI approximations, not a fit guarantee; side and back views are invented when the product photo shows only the front; clothing only for now; English, Hindi and Arabic only. Hindi and Arabic strings still need a native speaker's review.

**Claims to avoid** because we cannot support them: any conversion or return-rate numbers, "unlimited", "works with every theme" (checked on Dawn, Horizon and Debut Vintage only), anything about size recommendation, jewelry, eyewear or shoes.

## 2. Images to prepare

| Item | Requirement (as I remember it; verify) | Plan |
|---|---|---|
| App icon | 1200 × 1200, PNG or JPEG | Use the Mirrae arch mark on the site's dark or paper background; **not made yet** |
| Screenshots | 3 to 6, same size, desktop | 1) product page with the Try it on button; 2) the consent and upload dialog; 3) a three-view result; 4) the embedded admin page with credits; 5) the usage and conversion report. Capture from the dev store with the stock-photo result; label as illustrative |
| Demo video (optional) | 30 to 90 s | Screen recording of the same flow |

The people in the stock photos used on the marketing site have no model release: use generated or consented photos in screenshots, not those.

## 3. Reviewer instructions (paste into the submission)

> Mirrae adds a virtual try-on button to product pages. No Shopify access scopes are requested: the app reads only the shop name and domain through the session token, and writes its own app metafields (the public shop key and the widget address).
>
> **Test it**
> 1. Install the app. The embedded page (Apps > Mirrae) shows the shop, a Live switch, credits (5 free) and usage.
> 2. Press "Open theme editor". The Mirrae app embed is switched on; **press Save** (without Save the button does not appear).
> 3. Open any product that has an image of clothing (a flat-lay or model photo works best). A floating "Try it on" button appears at the bottom right of the store.
> 4. Press it, choose any full-body photo of a person, tick the consent box and press "See it on me". The result (front, side, back) arrives in about 30 seconds and uses 2 credits.
> 5. "Add to cart" on the result presses the store's own Add to cart button.
> 6. In the admin page, "Buy credits" opens a Shopify approval page. In this review environment charges are Shopify **test charges**; credits are added once after approval.
>
> **Notes**
> - Test products that are not clothing (for example the default snowboards) are rejected by design with a clear message.
> - Uninstalling switches the shop off; Shopify's shop/redact request erases the shop's data. `customers/data_request` and `customers/redact` are acknowledged because we keep no shopper personal data (photos are deleted right after the front view, events carry only an anonymous session id).
> - Support: connect@mirrae.org

If the reviewer cannot supply a person photo, point them to a stock full-body photo they can download; **do not** include a real person's photo in the submission without their written consent.

## 4. Before pressing Submit

| Check | Status |
|---|---|
| Privacy policy and terms live at the URLs above | Live in this branch; needs merge and deploy |
| `shopify app deploy` with production URLs | Released as `mirrae-3`; the toml change is on `feat/shopify-production-urls`, not yet on `main` |
| Billing in test mode (`SHOPIFY_BILLING_LIVE=false`) so reviewers are not charged | Set |
| App embed saved and button visible on a fresh install | Verified on the dev store (Dawn) |
| Billing-live flip planned for approval day (after the revenue-share check and legal) | Not done |
| Support mailbox `connect@mirrae.org` receives mail | Not confirmed |
| Phone number decision | Open |
| Icon and screenshots | Not made |
| Listing copy approved by you | This file |
