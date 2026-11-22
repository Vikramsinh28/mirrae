# =============================================================================
# Mirrae production image (a long-running `node server.js`, not serverless).
#
#   docker build -f infra/Dockerfile \
#     --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com -t mirrae .
#
# NEXT_PUBLIC_* values are baked into the browser bundle at build time, so build with the real address.
# Database migrations run from the `migrate` target (see the end of this file), not from the app image.
# =============================================================================

# Stage 1: base (Node 24 on Alpine; package.json asks for Node >= 22)
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Pinned so a new pnpm release cannot change how the image builds
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate

# Stage 2: dependencies (all of them: the build needs the dev dependencies too)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Several modules read these when they are imported, which `next build` does while collecting page data. The
# placeholders are given to the two commands below only (not as ENV), so they are in no image layer's environment and
# the runtime image, a different stage, gets its real values from the host.
RUN POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm run generate

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}

# Builds public/widget.js, then the Next.js app (output: 'standalone')
RUN POSTGRES_URL=postgresql://build:build@localhost:5432/build \
    JWT_SECRET=build-stage-placeholder-not-a-secret \
    STRIPE_SECRET_KEY=sk_test_build_stage_placeholder \
    pnpm run build

# Stage 4: migrations. Build with `--target migrate` and run it as a one-off job with POSTGRES_URL set.
FROM builder AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "run", "migrate:prod"]

# Stage 5: runtime (the default target): the standalone server only, no dev dependencies, not root
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
