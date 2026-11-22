# Deploying Mirrae on Google Cloud Run (Singapore)

Written 2026-11-22. **Nothing here has been run yet**: every step creates or changes something in the Google Cloud project, so each one is run on purpose. Chosen layout: Cloud Run in `asia-southeast1` (Singapore), Cloud SQL Postgres in the same region, one domain `mirrae.org`, the existing `mirrae-vertex` service account for Vertex AI. Singapore, not Mumbai, because Cloud Run's simple custom-domain mapping is not offered in `asia-south1` (a load balancer would be needed there). The checklist in `production-checklist.md` explains the rest.

Why these settings: the app is one long-running process that keeps rate limits and the Shopify sync throttle in memory and finishes try-ons in the background after the response (`after()`), so the service runs **exactly one instance** (`--min-instances 1 --max-instances 1`) with **CPU always allocated** (`--no-cpu-throttling`); otherwise Cloud Run freezes the CPU as soon as the response is sent and a try-on would stall.

Cost: an always-on instance plus the smallest Cloud SQL instance is roughly **$50-70 a month** (my estimate, not checked on Google's price calculator: check it before you commit). The free-trial credit pays for it for now.

## Status: deployed on 2026-11-22 (steps 1 to 7)

Service `mirrae` (revision `mirrae-00001-fh4`) at `https://mirrae-1007527773310.asia-southeast1.run.app`, Cloud SQL instance `mirrae-db` (database and user `mirrae`, daily backups), migration job `mirrae-migrate` (all migrations applied), seven secrets in Secret Manager (`jwt-secret`, `jwt-key`, `storefront-token-secret`, `shopify-api-secret`, `aws-access-key-id`, `aws-secret-access-key`, `postgres-url`), images in the Artifact Registry repository `mirrae`. Checked over HTTPS on the `run.app` address: `/`, `/widget.js`, a static file and `/privacy-policy` answer 200, an unregistered route 404, and the storefront session route answers `UNKNOWN_SHOP` for a made-up key (so the database query ran). **Not checked yet:** a real try-on from inside Cloud Run (Vertex AI through the attached service account, and S3), because the production database has no shop; that needs the domain and a Shopify install. Step 8 (the domain) is not done: the Hostinger registration email must be verified first.

## 0. Variables

```bash
export PROJECT=project-9cec8503-dd56-4295-a63
export REGION=asia-southeast1
export SA=mirrae-vertex@$PROJECT.iam.gserviceaccount.com
gcloud config set project $PROJECT
```

State on 2026-11-22: billing is enabled; only the Vertex AI and Compute APIs are on; the service account `mirrae-vertex` exists with the role `aiplatform.user`.

## 1. Turn on the services and create the repository

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  sqladmin.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create mirrae --repository-format=docker --location=$REGION
```

## 2. Let the service account read secrets and use the database

```bash
for ROLE in roles/secretmanager.secretAccessor roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=$ROLE --condition=None
done
```

## 3. Database (Cloud SQL Postgres 16)

```bash
gcloud sql instances create mirrae-db --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro \
  --region=$REGION --storage-size=10GB --storage-auto-increase --availability-type=zonal --backup-start-time=20:00
gcloud sql databases create mirrae --instance=mirrae-db
DBPASS=$(openssl rand -hex 24)
gcloud sql users create mirrae --instance=mirrae-db --password="$DBPASS"
```

Automated daily backups are on (`--backup-start-time`). If gcloud rejects the tier or edition, use `--tier=db-custom-1-3840`.

The app talks to it through the Cloud SQL socket. This URL form is the one that works with both `new URL` (used in `src/lib/prisma/index.ts`) and `pg`; the form with an empty host (`@/db`) does not:

```bash
printf 'postgresql://mirrae:%s@localhost/mirrae?host=/cloudsql/%s:%s:mirrae-db' "$DBPASS" "$PROJECT" "$REGION" \
  | gcloud secrets create postgres-url --data-file=-
unset DBPASS
```

## 4. Secrets

Production gets **new random values** for the first three (never the development ones). Nothing is printed.

```bash
openssl rand -base64 48 | gcloud secrets create jwt-secret --data-file=-
openssl rand -base64 48 | gcloud secrets create jwt-key --data-file=-
openssl rand -hex 32    | gcloud secrets create storefront-token-secret --data-file=-   # also signs the DNS ownership tokens: do not change it later

# These three keep their current values; read them from your local .env without printing them
for PAIR in shopify-api-secret:SHOPIFY_API_SECRET aws-access-key-id:AWS_ACCESS_KEY_ID aws-secret-access-key:AWS_SECRET_ACCESS_KEY; do
  grep "^${PAIR#*:}=" .env | head -1 | cut -d= -f2- | tr -d '"' | gcloud secrets create "${PAIR%%:*}" --data-file=-
done
```

(The AWS keys are required: the S3 code throws without them.)

## 5. Build the images (on Google's amd64 machines)

```bash
gcloud builds submit --config infra/cloudbuild.yaml \
  --substitutions _REGION=$REGION,_REPO=mirrae,_APP_URL=https://mirrae.org .
```

A new project needs one grant first: the default Compute Engine service account (`<project number>-compute@developer.gserviceaccount.com`) must have `roles/cloudbuild.builds.builder`, otherwise the source upload is refused with a 403 (done on 2026-11-22). The build log streams to your terminal; the upload follows `.gcloudignore` (about 10 MB).

## 6. Create the tables

```bash
IMG=$REGION-docker.pkg.dev/$PROJECT/mirrae
gcloud run jobs create mirrae-migrate --image $IMG/migrate:latest --region $REGION --service-account $SA \
  --set-cloudsql-instances $PROJECT:$REGION:mirrae-db --set-secrets POSTGRES_URL=postgres-url:latest
gcloud run jobs execute mirrae-migrate --region $REGION --wait
```

Run the same `execute` after every release that adds a migration, before the new service revision takes traffic.

## 7. Start the service

```bash
gcloud run deploy mirrae --image $IMG/mirrae:latest --region $REGION --service-account $SA \
  --port 3000 --cpu 1 --memory 1Gi --timeout 300 \
  --min-instances 1 --max-instances 1 --no-cpu-throttling \
  --add-cloudsql-instances $PROJECT:$REGION:mirrae-db \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_APP_URL=https://mirrae.org,SHOPIFY_API_KEY=62db0ffc96bb88cda0a9b3d7ed4904c3,AWS_REGION=ap-south-1,S3_PRIVATE_BUCKET_NAME=mirrae-tryon-private-056886146611,NEXT_PUBLIC_FILE_STORAGE_DRIVER=s3,GOOGLE_CLOUD_PROJECT=$PROJECT,VERTEX_LOCATION=us-central1,SHOPIFY_BILLING_LIVE=false \
  --set-secrets POSTGRES_URL=postgres-url:latest,JWT_SECRET=jwt-secret:latest,JWT_KEY=jwt-key:latest,STOREFRONT_TOKEN_SECRET=storefront-token-secret:latest,SHOPIFY_API_SECRET=shopify-api-secret:latest,AWS_ACCESS_KEY_ID=aws-access-key-id:latest,AWS_SECRET_ACCESS_KEY=aws-secret-access-key:latest
```

- `SHOPIFY_BILLING_LIVE=false` keeps every credit pack a Shopify **test** charge until you are ready to bill real money.
- `--allow-unauthenticated` is needed because shoppers and Shopify call it without logging in. If an organisation policy blocks public access (it already blocks service-account keys), an organisation admin has to allow it.
- The Stripe routes (`/api/billing/*`, `/api/webhooks/stripe`) fail without `STRIPE_SECRET_KEY`; they are not needed for a Shopify-only launch.
- Check it on the address Cloud Run prints (`https://mirrae-<number>.<region>.run.app`) before the domain: `/widget.js` answers 200 and the logs have no errors.

## 8. The domain `mirrae.org`

1. Prove to Google that you own it: `gcloud domains verify mirrae.org` (opens Search Console; add the TXT record it shows in Hostinger, **DNS / Nameservers**). Use the same Google account that owns the project.
2. `gcloud beta run domain-mappings create --service mirrae --domain mirrae.org --region $REGION`, and the same for `www.mirrae.org`.
3. `gcloud beta run domain-mappings describe --domain mirrae.org --region $REGION` lists the DNS records (A and AAAA for the bare domain, a CNAME to `ghs.googlehosted.com` for `www`). Add them in Hostinger and remove the parking records that conflict.
4. The certificate is issued by itself, usually within about 15 minutes and at most about 24 hours.

The Hostinger email (`support@mirrae.org`) uses MX records, which sit next to these without conflict.

## 9. After the domain works

1. In `shopify.app.toml` replace the tunnel address with `https://mirrae.org` everywhere (application URL, redirect and webhook URLs), check the file is not the local tunnel version, then `shopify app deploy`.
2. S3 bucket CORS: add `https://mirrae.org` (needs an AWS admin login).
3. On the dev store: open the app from the admin, try on a product, add to cart, buy a credit pack (test charge), and check that the shopper photo is gone afterwards.
4. The first sync after an install can fail once and retries after 20 seconds; the server log (`gcloud run services logs read mirrae --region $REGION`) shows `Shopify storefront config stored` when it worked.

## Updating later

Run step 5 (build), step 6 if a migration was added, then `gcloud run deploy mirrae --image $IMG/mirrae:latest --region $REGION`. To go back: `gcloud run services update-traffic mirrae --region $REGION --to-revisions <older revision>=100`.
