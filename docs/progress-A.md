# Lane A Progress — foundation, auth, Shipper vertical, cron, deploy

Owned by **Claude 1**. Step definitions: [`../BuildPlan.md` §6](../BuildPlan.md).

Status markers — `[~]` goes in BEFORE the work starts and is pushed on its own (BuildPlan §1 step 4):
`[ ]` not started · `[~]` in progress right now · `[x]` done + pushed · `[!]` blocked on a gate

| Step | Status | Title | Gate | Commit | Notes |
|------|--------|-------|------|--------|-------|
| A0 | [x] | Scaffold, database, container, Cloud Build | — | `701b8b5` | opened B0 |
| A1 | [x] | Firebase auth + session | — | `58830ab` | opened B3 + B4 |
| A2 | [x] | Onboarding & role routing | — | `3853f9f` | |
| A3 | [!] | Shipper dashboard | `auction-card.tsx` + `mobile-nav.tsx` | | BLOCKED(B2) — skipped per §1, taking A4 |
| A4 | [~] | Create auction + Google Maps routing | `ui/button.tsx` + `input.tsx` | | gate OPEN (B1 `c9e599d`); started 2026-08-08 |
| A5 | [ ] | Shipper auction details + live bids | `timer.tsx` + `bid-card.tsx` | | needs B2 |
| A6 | [ ] | Accept-bid transaction + cron | A5 | | |
| A7 | [ ] | Shipper history + deploy docs | A6 | | |

Out-of-band: `c6fd860` — pinned npm 11 in the Docker deps stage (Cloud Build `npm ci` fix).

## NOT VERIFIED
_Worklist the §7 verification phase inherits (CLAUDE.md §10.2)._

- **A0** — `npm ci` in a real container was never run; the npm 10/11 resolver mismatch was found only by
  reading Cloud Build's log. Most likely to be wrong: the `deps`→`builder` copy of `src/generated`, since
  `.dockerignore` excludes it and only `npm run build`'s own `prisma generate` repopulates it.
- **A1** — `/login` never rendered with real tokens (B0 landed after), and Google sign-in was never
  exercised against a real Firebase project. Most likely wrong: the `createSessionCookie` expiry maths, and
  whether `verifySessionCookie(cookie, true)` throws on a revoked user in a way the `catch` swallows too
  quietly.
- **A2** — `/onboarding` not seen at 390×844; the two role cards may overflow with tokens applied. The
  `setUserRole` reject path (role already set) was never triggered end to end.

## DEPS ADDED
_Packages this lane installed — the other lane must re-run `npm install`._

## Resolved versions (A0)
Next.js **16.3.0** (matches the PRD) · React 19.2.8 · TypeScript 5.9.3 · **Prisma 7.9.1** ·
`@prisma/adapter-pg` · **Tailwind v4** · zod 4 · vitest 4 · Node 22. Full table: TechnicalDocument.md §2.1.

## Deviations from the plan discovered during A0
Each is documented in TechnicalDocument.md; Lane B must read §2.2–§2.4 before starting B0.

1. **Tailwind v4 is CSS-first — `tailwind.config.ts` does not exist.** Tokens go in an `@theme { }` block
   in `src/app/globals.css`. B1's gate changed accordingly (BuildPlan §4). *(§2.4)*
2. **Prisma 7 broke the PRD's schema.** No `url`/`directUrl` in `schema.prisma`; connection strings live in
   `prisma.config.ts`; the client needs the `PrismaPg` driver adapter; generator is `prisma-client` with an
   explicit `output`. Client is generated to `src/generated/prisma`, **gitignored**, rebuilt by
   `postinstall`. *(§2.3)*
3. **No Docker on this machine → no `docker-compose.yml`.** Local development runs against **Neon**
   directly. ⚠️ Both lanes share one database and `npm run db:seed` truncates. *(§2.2)*
4. **`DEV_AUTH_BYPASS` guard moved from build-time to runtime.** Throwing in `next.config.ts` blocked
   `npm run build`, which every step's Definition of Done requires. `next.config.ts` now warns; A1's
   `session.ts` carries the real guard. *(§4.4)*
5. **Google Maps added mid-step** (user directive, decision D9). Six nullable route fields are already in
   the schema and migrated, and the seed carries real coordinates and distances, so Lane B can build
   against them immediately. Implementation lands in A4. *(§10)*

## A1 notes
- **Bug found by runtime verification: middleware must be `src/middleware.ts`.** At the repo root Next
  silently ignores it while *still* printing `ƒ Proxy (Middleware)` in the build output. Only surfaced by
  curling `/shipper` with the bypass off and getting a 404 instead of a redirect. Docs corrected.
- `/login` renders and is correct structurally, but its **visual verification at 390×844 is deferred until
  B0 lands** — the token classes it uses (`bg-primary-container`, `text-headline-lg`, `px-margin-mobile`)
  don't exist until Lane B writes the `@theme` block. The markup needs no further change; the styles will
  simply light up.
- With no Firebase keys configured, the sign-in button renders an honest **"Google sign-in unavailable"**
  disabled state rather than throwing on click.
- Verified: bypass=SHIPPER → `/` routes to `/shipper`; bypass=CARRIER → `/carrier`; bypass off → `/`,
  `/shipper`, `/carrier`, `/onboarding` all redirect to `/login`; `/login` renders 200; `/api/cron` is
  never redirected.

## A2 notes
- Added a third bypass mode, `DEV_BYPASS_ROLE="NONE"`, which impersonates the role-less seed user. It is
  the only way to reach `/onboarding` without hand-editing the database — worth having for anyone
  re-verifying this screen later.
- **Deliberate copy change.** Stitch says "You can change this later in settings." That is false:
  `setUserRole` rejects a second write, because switching roles would orphan a shipper's auctions or a
  carrier's bids. The screen now reads "This decides which app you see. It can't be changed later."
  Promising a setting we will not build is worse than a blunt sentence up front.
- Visual verification at 390×844 deferred to B0, same as `/login`.

## Cloud Build `npm ci` failure — root cause was npm's version, not the lockfile
Cloud Build died on `npm ci` with `Invalid: lock file's picomatch@2.3.2 does not satisfy picomatch@4.0.5`
plus `Missing: picomatch@2.3.2 from lock file` — two claims that contradict each other, which was the clue.

My first diagnosis (a lockfile corrupted by rapid successive `npm install` calls) was **wrong**. I deleted
and regenerated the lockfile, and `npm ci` passed — but `npm ci --dry-run` also passes against the
*original* lockfile still on `main`. The file was never corrupt.

**Actual cause: `node:22-alpine` ships npm 10.9.8, while the dev machines run npm 11.4.2.** npm 10 misreads
the resolution data npm 11 writes into a lockfileVersion-3 file and invents that picomatch conflict. Same
file, same command, different resolver, different verdict — which is exactly why it only ever failed in the
cloud.

**Fix:** the Dockerfile's `deps` stage now runs `npm install -g npm@11` before `npm ci`, so the resolver
reading the lock is the one that wrote it. No lockfile change was needed and none is committed.

⚠️ **If anyone's local npm moves to 12, bump that pin in the same commit**, or this failure comes straight
back and again only in Cloud Build.

## Lane B handoff items — actioned
From `docs/progress-B.md` → HANDOFF TO A:
1. **Shell API** — noted. `A3`/`A5` will compose `TopAppBar` + `AppScreen` + `MobileNav` at page level, and
   `A4` will pass `hasNav={false}` since the create form ends in a sticky footer button.
2. **Metadata module wired.** `src/app/layout.tsx` now re-exports `siteMetadata` / `siteViewport` from
   `@/lib/design/metadata`; the inline `metadata` / `viewport` exports are removed. The
   `formatDetection.telephone: false` it brings is a real fix — iOS otherwise auto-links ₹ amounts, kg
   weights and countdown digits into blue tappable phone links.
3. **`src/app/favicon.ico`** — accepted, not reverted. It was still the Next scaffold's Vercel triangle.
4. **`NEXT_PUBLIC_SITE_URL` added to `.env.example`** as a public, non-secret var, documented as optional.

Also corrected in BuildPlan §3: it claimed A0 pre-installs `tailwindcss-safe-area`. It does not, and
Tailwind v4 needs no plugin for `env()` — B0 hand-rolled the safe-area utilities. Lane B was right to flag it.

## Lane A is now blocked
`A3` needs `src/components/auction-card.tsx` + `mobile-nav.tsx` (Lane B's **B2**).
`A4` needs `src/components/ui/button.tsx` + `input.tsx` (Lane B's **B1**).
Per BuildPlan §1 the loop pulls every 60s and waits — it does not work Lane B's steps.
**All four Lane B gates are open**, so B0→B6 can run start to finish without Lane A.

## Google Maps — status
Schema + migration + seed data: **done in A0**. `LocationAutocomplete.tsx`, `src/lib/maps.ts` and
`calculateRouteAndCreateAuction`: **A4**. Note the ownership carve-out — `src/components/LocationAutocomplete.tsx`
sits in Lane B's tree but is **owned by Lane A** (BuildPlan §3, TechnicalDocument §10.3).
Both Maps keys are currently blank in `.env.local`, so the autocomplete runs in degraded mode
(plain text input, null coordinates) — by design, so neither lane is blocked on a billing-enabled key.

## HANDOFF TO B
_Defects found in Lane B files. Report, do not fix._

## Blockers log
_`<timestamp> — waiting on <gate>; re-checking in 60s`_
