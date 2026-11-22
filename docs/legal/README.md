# Legal drafts (not published, not reviewed)

`privacy-policy-draft.md` and `terms-of-service-draft.md` were written on 2026-11-22 from what the code actually does. They are **drafts for a lawyer**, not legal advice, and are deliberately **not wired into the website**. The live pages at `/privacy-policy` and `/terms-of-services` (`src/app/(dark)/...`) are still the old generic boilerplate (they talk about "job title", "documents" and "[Your Jurisdiction]"), so they do not describe Mirrae and must be replaced before the App Store listing needs a privacy URL.

## What you must decide or fill in (also marked `[like this]` in the drafts)

1. **Legal entity, address and contact emails** (privacy, support, security). The site has no contact email in `siteConfig` today.
2. **Governing law and courts.** Country and city; arbitration yes or no.
3. **Credits:** do they expire? Refund policy? Are prices tax-inclusive? (Code: credits do not expire; nothing handles refunds.)
4. **Retention of try-on records.** The code never deletes `TryOnJob` rows (they hold status, times, consent time, image keys that point at already-deleted files, no photos). Decide how long to keep them and add a cleanup, or say "kept for accounting".
5. **Retention of web server logs** (depends on where it is hosted, which is not chosen yet) and of conversion counts (`StorefrontEvent`; they are erased with the shop).
6. **Minimum age** and whether to ask shoppers for age confirmation.
7. **Who is the controller for shopper photos**: the draft says the store offers the try-on and Mirrae acts as its service provider. If you serve EU/UK shoppers you may need a data processing agreement with merchants.
8. **Whether merchants may keep and reuse result images** (terms section 8).
9. **Accounting retention period** for credit-purchase records, and the liability cap and indemnity wording.

## Facts in the drafts to re-check before publishing (so the text stays true)

| Claim | Where it comes from | To re-check |
|---|---|---|
| Shopper photo deleted right after the front view, also on failure | `deleteShopperPhoto` in a `finally`, `src/services/internal/tryon.ts` | still true after any change |
| Results and leftover photos expire within about two days | S3 lifecycle rule on `tryon/` (`infra/storage/tryon-lifecycle.json`); S3 rounds up | rule still applied; real bucket |
| No cookies or browser storage in the widget | grep of `src/widget` found none | widget changes |
| Photos go to Google (check + try-on + extra views); regions us-central1 and `global` | `tryon.ts`, `tryon-check.ts`, `tryon-views.ts` | Google's [data governance page](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance) (read 2026-11-22) says no training on customer data without permission, possible prompt logging for abuse monitoring, and that the `global` endpoint can serve from any region. Re-read it before publishing and check it against the terms on our account |
| Anonymous session id valid about 2h; counts only | storefront token, `StorefrontEvent` | token lifetime |
| IP used for in-memory rate limits | `src/lib/storefront/limits.ts` | what the host logs |
| We store no Shopify token; no scopes; store contact email stored | `src/services/internal/shopify.ts` | any new scope |
| Shop erased 48h after uninstall, owner closed, charge rows kept | `eraseShopifyShop` | accounting period |
| 1 credit single view, 2 credits for three views; failed extras charged 1 | `creditsForViewCount` and CLAUDE.md invariants | pack prices |
| HTTPS, private bucket, short-lived links | bucket policy, presigned URLs | production hosting (not set up yet) |
| Starter credits | `DEFAULT_INITIAL_CREDITS` = 5 | value |

## For the Shopify App Store

- The listing needs a **privacy policy URL** (and a support contact). Publish the reviewed policy first.
- The three privacy webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) are already handled. The two customer topics answer 200 because we keep no shopper data tied to a person; the policy says the same, so keep them in step.
- Stock people photos on the home page are illustrative and have no model release (see CLAUDE.md): get a legal view before launch.

## Wiring the final text into the site

After review: replace the two page files with a small shared component that renders the approved text (the old dark pages can go with the `(dark)` clean-up), keep `/privacy-policy` and `/terms-of-services` as the public URLs, and set the "last updated" date by hand instead of the build date.
