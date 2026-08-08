# TruckingGO — Cloud Run image (TechnicalDocument.md §9.1).
# Multi-stage: deps → builder → runner. Final image carries only the standalone server.

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# `npm ci` triggers postinstall → prisma generate, which needs the schema above.
RUN npm ci --ignore-scripts
RUN npx prisma generate

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so they
# must be present here. These four Firebase keys ship to the browser anyway — they
# are not confidential. Server secrets (DATABASE_URL, FIREBASE_ADMIN_*, CRON_SECRET)
# must NEVER be build args: they would be baked into image layers.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

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
