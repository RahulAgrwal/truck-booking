# TruckingGO — Cloud Run image (TechnicalDocument.md §9.1).
# Multi-stage: deps → builder → runner. Final image carries only the standalone server.

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat

# node:22-alpine ships npm 10.x, but package-lock.json is written by npm 11 on
# the dev machines. npm 10 misreads npm 11's resolution data and rejects the
# lockfile with a bogus "Invalid: lock file's picomatch@2.3.2 does not satisfy
# picomatch@4.0.5" — the same file `npm ci` accepts locally. Pin the major so
# the resolver that reads the lock is the one that wrote it.
RUN npm install -g npm@11 --no-audit --no-fund

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# --ignore-scripts skips postinstall; prisma generate runs explicitly below,
# after the schema is in place.
RUN npm ci --ignore-scripts
RUN npx prisma generate

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so they
# must be present here. The four Firebase keys and the Maps *client* key ship to
# the browser anyway — they are not confidential. Server secrets (DATABASE_URL,
# FIREBASE_ADMIN_*, GOOGLE_MAPS_SERVER_API_KEY, CRON_SECRET) must NEVER be build
# args: they would be baked into image layers.
#
# NEXT_PUBLIC_SITE_URL is not sensitive either — it is the app's own origin, and it
# is here rather than at runtime for the same inlining reason. Without it the
# `metadataBase` in src/lib/design/metadata.ts falls back to http://localhost:3000
# and every og:image, twitter:image and canonical URL resolves against localhost,
# which silently breaks every social preview.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Prisma needs a syntactically valid URL to generate. Never connected to.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .
RUN npm run build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrations travel with the image so the Cloud Build migrate step can run them.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
