# Deploying TruckingGO

The operating guide for `cloudbuild.yaml`. One-time project bootstrap — APIs, Artifact Registry, creating
the secrets, IAM — is [`gcp-setup.md`](./gcp-setup.md). The auction sweep's schedule is
[`cloud-scheduler.md`](./cloud-scheduler.md).

```bash
gcloud builds submit --config cloudbuild.yaml .
```

Four steps: **build → push → migrate → deploy**. Migrations run *before* traffic shifts, so a revision
never serves against a schema it does not expect.

---

## 1. What crosses into the image, and what does not

This is the part worth understanding before changing anything.

| Value | How it travels | Why |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (4), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **build args** | Next.js inlines them into the browser bundle, so they must exist at build time. They ship to every visitor by design and are defended by Firebase rules and HTTP-referrer restrictions |
| `NEXT_PUBLIC_SITE_URL` (Secret Manager: `PUBLIC_SITE_URL`) | **build arg** | Not sensitive — it is the app's own origin. It is a build arg for the inlining reason above, **not** because it is secret. Making it a runtime `--set-secrets` var would not work: the compiler has already frozen the fallback into the bundle |
| `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_ADMIN_*` (3), `GOOGLE_MAPS_SERVER_API_KEY`, `CRON_SECRET` | **runtime**, via `--set-secrets` | A build arg is recoverable from image layers forever. These are mounted when the container starts and never enter the image |

**If `PUBLIC_SITE_URL` is unset the build still succeeds** — `metadata.ts` falls back to
`http://localhost:3000`. Nothing errors; every `og:image`, `twitter:image` and canonical URL just
resolves against localhost, so social previews silently render nothing. Check it after a deploy:

```bash
curl -s https://YOUR-SERVICE-URL/login | grep -o '<meta property="og:image" content="[^"]*"'
# must print your real origin, not localhost
```

`GOOGLE_MAPS_SERVER_API_KEY` is deliberately absent from `availableSecrets` so it cannot be passed as a
build arg even by accident. **`NEXT_PUBLIC_` is an instruction to publish the value, not a naming style** —
adding that prefix to a server secret publishes it (CLAUDE.md §9).

Audit before any deploy that touches secrets:

```bash
grep -rn "AIza\|BEGIN PRIVATE KEY\|postgresql://" --include=*.yaml --include=Dockerfile .
# Only legitimate hit: Dockerfile's postgresql://build:build@localhost placeholder.
# Prisma needs a syntactically valid URL to run `generate`; it is never connected to.

grep -rn "GOOGLE_MAPS_SERVER_API_KEY" src/app src/components   # must be empty
```

---

## 2. Two failures this pipeline has already had

Both were environment mismatches that only appear in Cloud Build, so both cost a full deploy to find.

**`npm ci` rejecting a valid lockfile.** `node:22-alpine` ships npm 10; the lockfile is written by npm 11.
npm 10 misreads npm 11's resolution data and invents a `picomatch` conflict — the same file `npm ci`
accepts locally. The `deps` stage pins `npm@11` before `npm ci`. **If local npm moves to 12, bump that pin
in the same commit.**

**`/builder/home/.npm` EACCES in the migrate step.** That step runs the *runner* image, which drops to
`USER nextjs` (uid 1001), while Cloud Build points `HOME` at a root-owned directory. `HOME` and
`npm_config_cache` are set to `/tmp` — the only path reliably writable by an arbitrary uid in a step.

And one consequence of the same root cause: **Cloud Build runs every step with `cwd=/workspace`** — the
repo source, with no `node_modules`. `prisma.config.ts` therefore loads with **zero runtime imports**
(`dotenv` lazily in a `try`, `PrismaConfig` as a type-only import). Turning either back into a value import
breaks the deploy in a way nothing local reproduces.

---

## 3. Rolling back

Cloud Run keeps every revision. Rolling back is a traffic change, not a rebuild — seconds, not minutes.

```bash
gcloud run revisions list --service=truckinggo --region=asia-south1 --limit=5
gcloud run services update-traffic truckinggo --region=asia-south1 --to-revisions=<REVISION>=100
```

⚠️ **A rollback does not undo a migration.** Step 3 already ran, and Prisma has no down-migrations here.
An older revision meets the newer schema — fine for additive changes (a new nullable column), broken for a
destructive one. Prefer additive migrations; if a destructive one must ship, deploy the schema change and
the code that tolerates both in separate releases.

---

## 4. Rotating a secret

```bash
printf '%s' "$NEW_VALUE" | gcloud secrets versions add CRON_SECRET --data-file=-

# Runtime secrets are read at container start, so a new revision is required.
gcloud run services update truckinggo --region=asia-south1 \
  --update-secrets=CRON_SECRET=CRON_SECRET:latest
```

Build-time keys (`NEXT_PUBLIC_*`) are baked into the bundle, so rotating one needs a **full rebuild**, not
a traffic update. After rotating `CRON_SECRET`, also update the Scheduler job's header —
see [`cloud-scheduler.md`](./cloud-scheduler.md).

---

## 5. Logs

```bash
# Build
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>

# Runtime
gcloud run services logs read truckinggo --region=asia-south1 --limit=100
```

---

## 6. Release checklist (TechnicalDocument.md §9.7)

- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all clean locally
- [ ] Migrations committed, and **additive** — see the rollback caveat above
- [ ] Both secret greps in §1 return only the documented Dockerfile placeholder
- [ ] `gcloud builds submit --config cloudbuild.yaml .` completes all four steps
- [ ] New revision serving; `/login` loads and `/api/cron` returns 401 without a bearer
- [ ] Scheduler job green, `{ closed: n }` in its logs
- [ ] Smoke: sign in → post a load → bid from a second account → accept → both sides reflect it
