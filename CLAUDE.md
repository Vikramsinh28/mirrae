# Mirrae — Project Context for Claude Code

Mirrae is a virtual try-on SaaS for e-commerce stores. Merchants (Shopify store owners) install it to add a "Try it on" button to product pages. A shopper uploads a photo; we send their photo + the product image to a hosted try-on model (Google Vertex AI `virtual-try-on-001`; switched from fal.ai on 2026-11-14 because the fal balance ran out); ~10–40s later we return a composite of the shopper "wearing" the item. Billing is usage-based: 1 try-on = 1 credit.

Built on the Kostra Next.js SaaS boilerplate (MIT). Kostra supplies auth, Stripe + a credit system, S3/R2 uploads, and an admin/dashboard shell — reuse those, don't rebuild them.

## Stack (real versions — verified, not assumed)

- Next.js 16, App Router, TypeScript strict
- Prisma 7 — client generated into `src/lib/prisma/generated`
- Zod 3.25 — server schemas in `src/validations/`
- PostgreSQL
- Stripe — checkout, portal, webhook that tops up `User.credits`
- AWS S3 (`ap-south-1`) — private bucket, presigned PUT/GET (see "Storage (AWS S3)" below)
- JWT auth — cookie-based
- Deploy: long-running `next start` Node process (nixpacks/Docker), NOT serverless. This is why `after()` from `next/server` is safe for background work.

## Critical repo conventions (follow these or things break)

- Every route must be registered in `src/lib/routes/config.ts`. Middleware (`src/proxy.ts`) returns 404 for any unregistered page or API route.
- Auth pattern: every protected route does `getAuthUser(request)` → `getUserById(userId)`, returns `unauthorizedResponse()` if no user. "Merchant" = `User`.
- Credits: `CreditService.deductCredits({ userId, amount, operation, objectId, description })` (`src/services/internal/credit.ts`). Runs in a transaction, writes a `CreditHistory` row, returns `{ success, newBalance, error }` — it does not throw. Also `hassufficientCredits` (sic) and `getUserCredits`.
- Do not touch Stripe for try-on billing — top-ups already feed `User.credits`.
- Responses: use helpers in `src/lib/utils/response` (`successResponse`, `validationErrorResponse`, `insufficientCreditsResponse`, etc.). Zod errors via `formatZodError`.
- Repositories live in `src/services/repositories/*`. Internal services in `src/services/internal/*`. Third-party integrations in `src/services/external/*`.
- Frontend: axios service files in `src/services/api/*`, React Query hooks in `src/hooks/*`, atomic-design components (`atoms/molecules/organisms`).

## Storage (AWS S3) — set up 2026-11-13

- Own AWS account `056886146611` (kept separate from the RMO/Kostra project's account). Region `ap-south-1`.
- Private bucket `mirrae-tryon-private-056886146611`: all public access blocked; CORS allows `PUT`/`GET` from `http://localhost:3000` only (add the production domain when there is one); 24h expiry rule on the `tryon/` prefix (from `infra/storage/tryon-lifecycle.json`, verified on the bucket).
- IAM user `mirrae-app`, least privilege: `s3:PutObject/GetObject/DeleteObject` on that bucket's objects + `s3:ListBucket` on the bucket, nothing else. Its keys are `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `.env` (gitignored). Rotate them with `aws iam create-access-key` / `delete-access-key` as an admin.
- `.env`: `NEXT_PUBLIC_FILE_STORAGE_DRIVER=s3` (the code defaults to `r2`, so this must be set), `AWS_REGION=ap-south-1`, `S3_PRIVATE_BUCKET_NAME`. `S3_PUBLIC_BUCKET_NAME` is unused by try-on; if left empty the code falls back to `kostra-data-public`/`kostra-data-private` names, so never leave `S3_PRIVATE_BUCKET_NAME` empty.
- The root user was only used once to create these; admin work needs a fresh `aws login --profile <name>` (use a named profile, then `aws logout`). Agent sessions have no AWS admin access; the `aws-mcp` server here is documentation-only.
- Not set up (not needed yet): SES email (needs a verified sender domain), production hosting, billing budget alert.

## Databases — READ CAREFULLY

- `mirrae` — dev database. `POSTGRES_URL` in `.env`. Runs in Docker container `mirrae-postgres-dev` (postgres:16-alpine, `127.0.0.1:5440`, persistent volume `mirrae-postgres-dev-data`, `--restart unless-stopped`). Migrations applied 2026-11-13 with `npx prisma migrate deploy` (4 migrations, incl. both `tryon_job` ones).
- `mirrae_test` — tests only. Jest global setup reads `TEST_POSTGRES_URL` and refuses any DB whose name doesn't end in `_test`. It runs `prisma db push --force-reset`, so it WIPES whatever it points at — that's why it's isolated to `_test`. Runs in Docker container `mirrae-postgres-test` (`127.0.0.1:5439`, tmpfs: data is lost when the container stops; restart with `docker start mirrae-postgres-test`, recreate if the container was removed).
- `kostra` — a DIFFERENT project's database on the same Postgres server. NEVER touch it.
- Running tests: `npx jest` against `mirrae_test`. Prisma blocks `db push --force-reset` when an AI agent runs it unless `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` is set — do NOT set that flag yourself; ask the human to run the full suite. Use `SKIP_DB_SETUP=1 npx jest` for logic-only runs.

## Try-On feature — current state & invariants (Stage 1)

Built and unit-tested. Files:

- **Provider files (the only provider-aware ones, all in `src/services/external/`):** `tryon.ts` (Vertex AI `virtual-try-on-001`, synchronous `predict`, 75s budget, base64 in/out: `runTryOn({ personImageBase64, productImageBase64 }) → { image: { bytes, contentType } }`), `tryon-check.ts` (pre-flight photo validation, see below), `tryon-views.ts` (side/back views via Gemini image editing `gemini-2.5-flash-image`, location `global`; ~45s each, run in parallel) and `vertex-client.ts` (auth via `google-auth-library`: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_APPLICATION_CREDENTIALS` or local `gcloud auth application-default login`; env `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION` default `us-central1`). Switched from fal.ai on 2026-11-14 (fal balance ran out). A third-party source says `virtual-try-on-001` is deprecated 2027-03-15 — re-check. Safety-filtered results come back without an image and fail the job (never charged).
- `src/services/internal/tryon-image.ts` — `prepareTryOnImage`: every input photo is normalised with `sharp` before the provider sees it (EXIF rotate, flatten alpha, crop solid letterbox bars (max 25% per side), ≤2048px, JPEG). Vertex only accepts JPEG/PNG ≤10 MB, so WebP uploads work only because of this step.
- `src/services/internal/tryon.ts` — job orchestration: download+prepare both photos → front view → (3-view jobs) side+back → charge.
- `src/services/repositories/tryon-job/index.ts` — Prisma access.
- `src/validations/tryon.ts` — Zod schemas.
- `src/app/api/tryon/create/route.ts` (POST body `{ personImageKey, productImageKey, views?: 'single'|'multi', consent: true }` → 202 `{jobId}`, runs `processJob` via `after()`), `src/app/api/tryon/status/route.ts` (GET `?jobId=`).
- `src/services/api/tryon.ts`, `src/hooks/useTryOn.ts` (create + poll every 2s).
- `src/app/app/try/page.tsx` — demo surface (views picker, photo tips, `TryOnResultGallery` with front/side/back thumbnails that fill in while extras generate).

Invariants — do not break these:

- **Exactly-once charge:** deduction only runs after an atomic claim — `updateMany({ where: { id, status: 'DONE', chargedAt: null, extrasSettledAt: { not: null } }, data: { chargedAt } })` succeeding on exactly one row. Never charge outside this claim.
- **Credit rule (decided 2026-11-14):** `views: 'single'` = front only = 1 credit; `views: 'multi'` = front + side + back = 2 credits, checked up front (`hassufficientCredits(userId, 2)`). If an extra view fails the job is still delivered and charged only 1. The charge waits for `extrasSettledAt` (set immediately for single-view jobs, after both extras finish/fail for 3-view jobs), so the amount is known before the claim.
- **Pre-flight photo check (`tryon-check.ts`):** before the paid try-on call, a Gemini vision model (`VERTEX_CHECK_MODEL`, default `gemini-3-flash-preview`: the only text/vision Gemini this project can call; it is a preview model, re-check) classifies both photos in ~3-5s. Vertex otherwise "tries on" a photo with no person and returns garbage that would be charged. Problems fail the job with a code stored in `TryOnJob.error` (`NO_PERSON`, `MULTIPLE_PEOPLE`, `PERSON_TOO_SMALL`, `NOT_CLOTHING`) and are never charged; `getStatus` maps codes to user messages and any unknown stored string to the generic message (never expose raw error text). The check fails OPEN (an outage must not block try-ons). Watermarks on product photos are not rejected (they bleed into results; the UI tells users to avoid them).
- **Free credits:** `DEFAULT_INITIAL_CREDITS` in `src/lib/constants/credits.ts` is 5 (was 100: every try-on costs real money); `createUser` uses it and the `User.credits` schema default matches (migration `20261114130000_default_free_credits`; check it was applied before relying on the DB default).
- **Credit integrity (fixed 2026-11-14):** `CreditService.deductCredits/addCredits` are single atomic UPDATEs (`credits >= amount` conditional decrement / increment; amounts must be finite and > 0). They used to read-then-write, which lost credits under concurrency. Job creation goes through `repo.createTryOnJobIfAffordable`: a per-user `pg_advisory_xact_lock` (called with `$executeRaw`: the function returns `void`, which `$queryRaw` cannot deserialize; that broke every try-on create until a live run caught it, because mocked unit tests cannot see raw-SQL problems, so run a live check or the DB integration tests after touching raw SQL), then `credits - credits held by that user's running jobs >= needed` (held = QUEUED/PROCESSING or DONE-uncharged jobs updated in the last 10 min, priced with `creditsForViewCount`), so several jobs started at once cannot all finish unpaid. The Stripe top-up (`addCreditsAndUpdateCreditHistoryTransaction`) locks the customer row `FOR UPDATE` first, so it cannot overwrite a concurrent charge and a duplicate webhook cannot double-credit. Concurrency tests live in `tryon.integration.test.ts` (run by a human against `mirrae_test`).
- **Anonymous storefront API (Phase 1, built 2026-11-14):** `POST /api/storefront/session` (public key + Origin -> signed 2h token), `POST /api/storefront/photo` (raw image body, header `X-Storefront-Token`; cleaned with sharp, checked for a person right away via `findPersonProblem`, stored under `tryon/person/<shopId>/<sessionId>/`), `POST /api/storefront/tryon` (photoKey, productImageUrl, views, consent -> 202 jobId; product image downloaded server-side by `fetchProductImage` against the shop's `imageHosts` + `domain` allowlist), `GET /api/storefront/status?jobId=`. Logic in `src/services/internal/storefront.ts`, HTTP plumbing in `src/lib/storefront/http.ts`. A `Shop` (`prisma/schema.prisma`, migration `20261114140000_shops`, applied to `mirrae`) belongs to a merchant `User` whose credits pay; jobs carry `shopId`/`sessionId` and use `tryon/<kind>/<shopId>/<sessionId>/<file>` keys (never mixed with account keys). Protections: token bound to shop + session, Origin must be in `Shop.allowedOrigins` on every call, rate limits (`src/lib/storefront/limits.ts`: per IP and per session), per-shop `dailyTryOnCap` (UTC day), 8 MB photo cap enforced while streaming, and shoppers only ever see "temporarily unavailable" for cap/credit problems. CORS: storefront preflight echoes any origin without credentials (`src/lib/routes/cors.ts`); the real request is gated by the token + shop origins. Needs `STOREFRONT_TOKEN_SECRET` in `.env`. Create a test shop with `npx tsx --env-file=.env scripts/create-shop.ts --owner-email ... --name ... --domain ... --origin https://...`. After schema changes the running dev server MUST be restarted (its cached Prisma client lacks new models). Verified live 2026-11-14 on a test shop (`Mirrae Test Store` in the dev DB): wrong origin refused, no-person photo rejected at upload, SSRF url refused, 3-view try-on delivered in ~29s and charged exactly 2 credits. - **Embeddable widget (built 2026-11-14):** `src/widget/*` (vanilla TypeScript, no framework; Shadow DOM so a store's CSS cannot touch it) is bundled by `scripts/build-widget.mjs` (esbuild, ~9.5 KB gzip) into `public/widget.js` (gitignored; `pnpm dev` and `pnpm build` build it first, `pnpm dev:widget` watches). A merchant adds `<script async src="https://<app>/widget.js" data-shop-key="pk_live_..."></script>`; options are `data-api`, `data-views` (single|multi, default multi), `data-color` (hex), `data-label`, `data-lang` (en|hi|ar, else the page language), `data-target` (CSS selector for the button, else a floating button), `data-product-image` (else JSON-LD Product image, then og:image). Files: `config.ts` (reads data-* defensively), `product-image.ts`, `api.ts` (session, upload, try-on, polling; reopens an expired session once, rides out short network blips), `i18n.ts` (Hindi and Arabic text needs native-speaker review), `ui.ts` + `styles.ts`. It emits `mirrae:open|result|error` window events and exposes `window.Mirrae.open()`. The overlay is sized to the visual viewport (pages that overflow sideways otherwise push a fixed overlay off-screen on phones). `/widget.js` and `/widget-demo.html` are public routes. Local preview without cost: `/widget-demo.html?key=pk_live_x&mock=1&image=https://example.com/a.jpg&lang=hi` (mock=noperson|noback|capped for error states; the page fakes the storefront API). Logic is unit-tested in node; the UI itself has no automated test (no jsdom), it was checked by hand in the browser on desktop, mobile + Hindi and Arabic RTL, and live against the test shop. Same-origin GETs carry no Origin header, so `requestOrigin()` falls back to the request origin only when `Sec-Fetch-Site: same-origin`. Extra views retry on a Gemini 429 (4s, 8s). Still to build: the merchant-facing install steps and Shopify theme extension (the widget is the piece they will load), merchant dashboard, admin panel, Shopify adapter.
- **Back views are invented** when the product photo shows only the front; the landing FAQ says so. Never claim they are exact.
- **Consent required:** `TryOnJob.consentAt` is NOT NULL; `create` requires `consent: true` (exactly true). No job without consent.
- **Privacy:** the shopper photo is deleted in a `finally` (so also on failure) right after the front view, before the slow extra views start (they only need the front result). An S3 lifecycle rule expires the `tryon/` prefix after 24h (applied; see "Storage (AWS S3)").
- **Stale handling:** jobs stuck in PROCESSING or QUEUED beyond the threshold are failed, never charged. `markJobDone` only moves PROCESSING→DONE.
- Presigned GET URLs to the provider last 3600s (≫ 75s budget).
- Known trade-off: a hard crash between "mark DONE" and "charge" loses one credit of revenue. Accepted; comment is in the code.

## Secrets

- `.env` is gitignored (`.gitignore` line 31). Never commit `.env`; the Google service-account key and `POSTGRES_URL` live there. Placeholders are in `.env.example`.
- Git state (as of 2026-11-13): `git init` has been run and there are three "first commit" commits, but nearly all project files are still untracked. Check `git status` before the first real commit and confirm `.env` is not staged.

## Known debts (fix at the noted time)

- 24h expiry rule on `tryon/`: applied to the S3 bucket 2026-11-13 (see "Storage (AWS S3)"). If another bucket is ever added, apply `infra/storage/tryon-lifecycle.json` with `aws s3api put-bucket-lifecycle-configuration`; it REPLACES the bucket's whole lifecycle config, so `get-bucket-lifecycle-configuration` first and merge.
- Add the production domain to the bucket CORS when deploying; set up a billing budget alert on the AWS account.
- Route-handler tests: `src/test/api/tryon/tryon.test.ts` (mocked service, `SKIP_DB_SETUP=1` ok) and `tryon.integration.test.ts` (real Postgres; written but NOT yet run against a real `mirrae_test`, run it with `npx jest src/test/api/tryon/tryon.integration` once `TEST_POSTGRES_URL` is set). It refuses to run unless the DB name ends in `_test`.
- `.env` `POSTGRES_URL` and `TEST_POSTGRES_URL` now point at the Docker `mirrae` / `mirrae_test` databases (fixed 2026-11-13; they used to point at `kostra` / nothing). Prisma migrations `20261107*_tryon_job*` may still have been applied to the old `kostra` database from earlier: check by hand, never from an agent session. `jest.setup.js` falls back to an unreachable URL instead of `kostra_test`.
- Real-provider smoke test (spends one Vertex request, needs `GOOGLE_CLOUD_PROJECT` + credentials; local JPEG/PNG files): `npx tsx --env-file=.env scripts/tryon-smoke.ts <person> <garment> [out-prefix] [--views]`. Measured 2026-11-14 (Vertex `virtual-try-on-001`): front view 13-17s; side+back together ~12s in parallel when not rate-limited (~45-90s each under Gemini 429 pressure; a new project's Gemini quota is low). Synthetic test set (3 casual user photos x 5 garment types, flat-lay/ghost/on-model/busy-background) all worked with Vertex; Gemini alone redrew the photo or ignored the garment, so it is only used for extra views. Cost per image not yet confirmed on the GCP billing page (a third-party source says ~$0.06). Known weakness: a person photo on a dark/studio backdrop plus a garment photo with a different background can blend the two (and copy watermark text like "Ndk" into the result); the UI tells users to use plain backgrounds and no watermarks.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is empty in `.env`, so the sign-in modal throws "Missing required parameter client_id" when opened. Set it (Google Cloud OAuth client) to test sign-in.
- Replace the hero SVG illustration with real before/after try-on images; add an `opengraph-image` for link previews.
- Unauthenticated storefront abuse / rate-limiting is a Stage 2 concern (see the `TODO Stage 2` note in `create`).

## UI/UX skill

`.claude/skills/ui-ux-pro-max/` (from github.com/nextlevelbuilder/ui-ux-pro-max-skill, MIT, installed 2026-11-13; `${CLAUDE_PLUGIN_ROOT}` paths in its SKILL.md were rewritten to project-relative). Use it for any UI work: generate a design system with `python3 -I .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p Mirrae`. Persisted design decisions go in `design-system/mirrae/MASTER.md` (read it before building pages). Its generator's top style pick can be off for web (it suggested an Apple-platform style), so sanity-check it.

## Public landing site

Mirrae-branded landing page lives in `src/components/mirrae/*` (copy in `src/data/mirrae-content.ts`), rendered by `src/app/(branding)/page.tsx` with `SiteNav`/`SiteFooter` from `(branding)/layout.tsx`. Design tokens (`mirrae-ink/paper/gold`, fonts `font-impact` Syne for big uppercase headlines, `font-display` Cormorant italic for accent words, `font-body` Montserrat) and motion keyframes are in `globals.css`; above-the-fold content uses CSS-only `Rise` (not JS `Reveal`) so it paints before hydration; spec in `design-system/mirrae/MASTER.md`. Every claim in the copy must match real behaviour (no invented stats, logos or testimonials). The hero before/after is an SVG illustration (`try-on-figure.tsx`) until real try-on photo pairs exist. The old Kostra marketing components in `src/components/branding/` are now unused except `userProfile.tsx`.

## How to work in this repo

1. Explore before coding. For any non-trivial task, first report where the relevant existing code lives and what you'll reuse.
2. Propose a plan and wait for approval before large or irreversible changes (schema migrations, new subsystems, touching auth/billing).
3. Show migrations before running them. Never run a destructive DB command without explicit approval.
4. Reuse Kostra's helpers (auth, credits, Stripe, S3/R2, response, Zod) — match existing patterns; don't introduce a new pattern where one exists.
5. Validate all inputs with Zod. Keep the try-on provider swappable (one file).
6. Work in small, reviewable steps. Run `tsc` and the relevant tests before declaring something done.

## Roadmap

- **Stage 0 — Demo generator.** Done (standalone).
- **Stage 1 — Try-on pipeline on one surface.** Built & unit-tested. Immediate task: run the new DB-backed tests and an in-app 3-view try-on (Vertex creds work locally via ADC; the org policy blocks service-account keys, so production needs an attached service account / workload identity), run the full suite against `mirrae_test`, add the pending route tests.
- **Stage 2 — Installable Shopify app (NEXT).** Theme app extension for one-toggle install; pull product images from the store; credit-metered "Try it on" widget on a live storefront; handle unauthenticated shopper traffic (rate-limiting/abuse); Shopify OAuth + webhooks.
- **Stage 3 — Differentiators (later, only once merchants are paying).** AI shopping assistant (multilingual edge for India/UAE), size recommendation, "complete the look" upsell, return-rate analytics.
