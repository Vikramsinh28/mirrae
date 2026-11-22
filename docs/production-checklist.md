# Going to production: checklist

Written 2026-11-22. Everything today runs on a laptop behind a tunnel. This is the order I would do it in, what each step needs from you, and what to check afterwards. Nothing here has been run on a real host yet.

## 1. Host (needs your decision and account)

Mirrae is a **long-running Node process** (`npm run build`, then `npm start`), not serverless: background work uses `after()` and the rate limits and the Shopify sync throttle are kept per process. So run **one instance** (or move those to a shared store first).

- Node 22, Postgres 16, outbound https to Google, AWS, Shopify and Stripe.
- `infra/Dockerfile` exists (unverified; check that it builds the widget and runs `next start`).
- Give it a real **https domain**, for example `app.<your domain>`.

## 2. Database

- Create a new production Postgres (never reuse `mirrae`, `mirrae_test` or the other project's database).
- Apply migrations with `npm run migrate:prod` (`prisma migrate deploy`). Never run `migrate dev` or `db push` against production.

## 3. Environment variables

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | the https domain (the shop key sync writes nothing if it is not https) |
| `POSTGRES_URL` | the production database |
| `JWT_SECRET`, `JWT_KEY` | **new long random values**. `.env.example` ships `test_jwt_secret` and `boilerplate-token`: never use those in production (the app does not refuse them) |
| `STOREFRONT_TOKEN_SECRET` | new long random value. It also signs the website-ownership DNS tokens: changing it later invalidates both |
| `NEXT_PUBLIC_FILE_STORAGE_DRIVER` | `s3` (the code defaults to `r2`) |
| `AWS_REGION`, `S3_PRIVATE_BUCKET_NAME` | `ap-south-1`, the private bucket. Prefer an instance role over `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` if the host supports one |
| `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION` | the project, `us-central1` |
| Google credentials | **an attached service account or workload identity**: the org policy blocks service-account keys, so `GOOGLE_SERVICE_ACCOUNT_JSON` may not be possible |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` | the client ID and the **rotated** secret |
| `SHOPIFY_BILLING_LIVE` | **`false` until you are ready to bill real money.** With `NODE_ENV=production` and this unset, every credit pack is a real charge |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | only if merchants outside Shopify sign in with Google (create an OAuth client; the sign-in modal fails without it) |
| Stripe variables | only if web (non-Shopify) merchants buy credits |
| `EMAIL_DRIVER` and the sender variables | only when email is set up (SES needs a verified sender domain; not set up) |

Never commit these. Put them in the host's secret store.

## 4. Things on the AWS side (needs an admin login; the agent has none)

- **S3 CORS:** add the production domain next to `http://localhost:3000`, and, for one-tap "save" on a store, the store origins. Read the current rules first, then merge.
- Confirm the 24h `tryon/` lifecycle rule is still applied (`infra/storage/tryon-lifecycle.json`).
- Create a **billing budget alert**.

## 5. Shopify

1. Rotate the client secret in the Dev Dashboard (the old one was pasted into a chat), put the new one in the host's secrets and your local `.env`.
2. In `shopify.app.toml` replace every tunnel address with the production domain, then run `shopify app deploy`. The compliance and `app_purchases_one_time/update` webhooks, the `/shopify` application URL and the theme app extension all come from that file.
3. Check that the toml you deploy is not the local tunnel version.
4. Install from the app's distribution link on a store and run the dev-store checks again against production (try-on, add to cart, credit pack with `SHOPIFY_BILLING_LIVE=false`).

## 6. Before real money

- Confirm Shopify's revenue share in the Partner Dashboard (the prices in `src/lib/shopify/billing.ts` assume 15% above the first $1M; Shopify's docs and one snippet disagreed). The try-on cost itself is confirmed from the GCP SKU price list (about $0.06 per front view, $0.039 per extra view, about $0.069 per credit for 3-view jobs).
- **Google account deadlines** (shown in the Cloud console on 2026-11-22): turn on 2-step verification by **2026-11-28** to keep console access, and complete the account identity verification by **2027-03-14** (otherwise the account may be suspended or terminated). The try-on runs on this account.
- Legal drafts reviewed, blanks filled and published at `/privacy-policy` and `/terms-of-services` (`docs/legal/`).
- Then set `SHOPIFY_BILLING_LIVE=true`.

## 7. After deploy: quick checks

- `https://<domain>/widget.js` loads and `/api/storefront/session` answers from an allowed origin and refuses another.
- A try-on from a test shop completes, the shopper photo is gone afterwards, and credits are charged once.
- The Shopify embedded page loads, the shop key is stored on the app installation, and the button shows on the store.
- The server log shows no `Shopify storefront config sync failed` after the first minute.

## Open for later

- More than one instance needs the rate limits and the sync throttle in a shared store.
- `virtual-try-on-001` is reportedly deprecated on 2027-03-15 (third-party sources only; Google's model page does not say). Check Google's model list for a successor and its price before then.
