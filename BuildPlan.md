# BuildPlan.md — Autonomous Two-Lane Build

**Read [`CLAUDE.md`](./CLAUDE.md) first, then this file.**
This is the driver document. Two Claude instances execute it in parallel, forever, without asking the user
anything. Lane A builds the foundation and the Shipper vertical. Lane B builds the design system and the
Carrier vertical.

---

## 0. Session start — ask which Claude you are

**Before the loop begins, on every new session**, ask the user with `AskUserQuestion`:

> **"Which Claude am I in this session?"**
> · **Claude 1 → Lane A** — foundation, auth, Shipper vertical, cron, deploy (`A0`–`A7`)
> · **Claude 2 → Lane B** — design system, shared components, Carrier vertical (`B0`–`B6`)

Write the answer to `docs/LANE.md` as `LANE: A` or `LANE: B`, then start the loop. Never infer your lane
from the directory, the git log, or which files exist — two instances that both assume Lane A will
overwrite each other on `main`.

**Resuming:** if `docs/LANE.md` already carries a lane *and* the matching ledger shows work in progress from
this checkout, say "Resuming as Claude 1 / Lane A at step A3" and continue without asking. Any ambiguity →
ask.

This is the only point in the build where you stop for the user.

---

## 1. The loop

Repeat this until every step in your lane is `DONE`. Do not stop between steps. Do not ask for approval.

```
LOOP:
  1. git pull --rebase origin main
  2. Read docs/LANE.md → am I Lane A or Lane B?   (set at session start, §0)
     Read docs/progress-<lane>.md → what have I finished?
  3. Find the FIRST step in my lane with status TODO whose GATE (§4) is satisfied.
       · No eligible step because a gate is unmet?
           → sleep 60s, git pull --rebase origin main, re-check. Repeat.
             (The other lane is mid-step; the gate WILL open. Never work their step to unblock yourself.)
       · No eligible step because my lane is finished?
           → go to §7 Completion.
  4. Mark it IN_PROGRESS in docs/progress-<lane>.md.
  5. Implement it. Touch ONLY files in my ownership list (§3).
  6. Verify: the step's own acceptance checks, then the Definition of Done (CLAUDE.md §10).
       · Verification fails? Fix it. Do not commit red. Do not mark DONE.
  7. Update docs/progress-<lane>.md → DONE + notes. Update any doc section the step changed.
  8. git add -A
     git commit -m "<StepID>: <summary>"
     git pull --rebase origin main        ← the other lane has been pushing
     git push origin main
  9. GOTO LOOP
```

**Never** batch two steps into one commit. One step = one commit = one push. This keeps the other lane's
rebases small and keeps the gate signals crisp.

---

## 2. Lane summary

| | Lane A | Lane B |
|---|---|---|
| Owns | Foundation, auth, Shipper vertical, cron, deploy | Design system, shared components, Carrier vertical |
| Starts with | `A0` (blocks everything — push it fast) | `B0` (waits only on A0) |
| Steps | A0 → A7 | B0 → B6 |
| Ledger | `docs/progress-A.md` | `docs/progress-B.md` |
| TechnicalDocument sections | §1–§5, §9 | §6–§8 |

---

## 3. File ownership — the anti-conflict contract

Both lanes push to `main`. Conflicts are prevented by ownership, not by luck. **If a file is not in your
column, you do not create it, edit it, delete it, or rename it.**

### Lane A owns
```
package.json  package-lock.json  tsconfig.json  next.config.ts  eslint.config.*  .gitignore
Dockerfile  .dockerignore  cloudbuild.yaml  .gcloudignore  .env.example
vitest.config.mts  prisma.config.ts
prisma/**                              (schema, migrations, seed)
src/middleware.ts   (must live under src/ — Next resolves it beside the app dir)
src/app/layout.tsx  src/app/page.tsx
src/app/(auth)/**                      (login, onboarding)
src/app/(dashboard)/shipper/**
src/app/api/**
src/lib/prisma.ts  src/lib/session.ts  src/lib/schemas.ts
src/lib/firebase/**
src/lib/actions/user.ts  src/lib/actions/auction.ts
src/lib/format.ts                      (currency, weight, dates)
src/lib/maps.ts                        (Distance Matrix — SERVER key only)
src/components/LocationAutocomplete.tsx   ← CARVE-OUT: inside Lane B's tree, owned by A
docs/progress-A.md  docs/cloud-scheduler.md  docs/deploy.md  docs/gcp-setup.md
docs/LANE.md          (gitignored — per-checkout, written by whichever agent owns the checkout)
TechnicalDocument.md  §1–§5, §9
```

### Lane B owns
```
src/app/globals.css   (Tailwind v4 is CSS-first — the @theme token block lives HERE,
                       there is no tailwind.config.ts; see TechnicalDocument.md §2.4)
src/components/**                      (ui primitives + all shared components)
src/app/(dashboard)/carrier/**
src/app/(dashboard)/profile/**
src/lib/actions/bid.ts
src/lib/design/**
public/manifest.json  public/icons/**  public/fonts/**
docs/progress-B.md  docs/stitch-screens.md
TechnicalDocument.md  §6–§8
```

### Shared, read-only to both
```
CLAUDE.md  BuildPlan.md  TruckingGO_Master_PRD.md
```
Change one of these only to fix an outright error, in a commit that changes nothing else, and note it in
your ledger.

### The genuinely shared surfaces, and how they're handled
- **Two Lane-B files are seeded by `A0` and immediately handed over.** `src/app/layout.tsx` (Lane A's) must
  import `./globals.css` and wrap `{children}` in `<AppShell>` for the project to compile at all, so A0
  creates the two files those imports need — as **stubs, in Lane B's tree**:
  - `src/app/globals.css` — nothing but `@import "tailwindcss";` (Tailwind v4).
  - `src/components/app-shell.tsx` — `({children}) => <>{children}</>`, carrying a `// B0 replaces this` comment.

  These are the **only** two files Lane A ever creates outside its own tree, they exist solely so `npm run
  build` passes before B0 lands, and **B0 overwrites both wholesale** — Lane B does not merge with or
  preserve anything in them. After A0, Lane A never touches either file again.
- **`src/components/LocationAutocomplete.tsx`** — the one file inside `src/components/**` that Lane A owns.
  It is used only by the shipper's create-auction form (A4); gating A4 on a Lane B step would serialise the
  lanes for nothing. **Lane B must not create or edit it.** See TechnicalDocument.md §10.3.
- **`package.json`** — Lane A owns it. Lane B needs a dependency? Do **not** edit `package.json`. Record it
  in `docs/progress-B.md` under `DEPS REQUESTED`; Lane A picks it up at its next step boundary. B0 needs no
  new packages — Inter comes from `next/font`, Material Symbols is a webfont `<link>` already in
  `layout.tsx`, and Tailwind v4 handles safe-area insets in CSS — so this should never trigger.

---

## 4. Gate table

A gate is "does this file exist after `git pull`". Nothing else. No time-based coordination, no messaging.

| Step | Gate | Meaning |
|---|---|---|
| `A0` | *(none)* | Start immediately |
| `A1` | *(none)* | |
| `A2` | *(none)* | |
| `A3` | `src/components/auction-card.tsx` **and** `src/components/mobile-nav.tsx` exist | B2 pushed |
| `A4` | `src/components/ui/button.tsx` exists | B1 pushed |
| `A5` | `src/components/timer.tsx` **and** `src/components/bid-card.tsx` exist | B2 pushed |
| `A6` | A5 done | |
| `A7` | A6 done | |
| `B0` | `package.json` exists | A0 pushed |
| `B1` | `@theme` block present in `src/app/globals.css` | B0 done (own lane) |
| `B2` | B1 done | |
| `B3` | `src/lib/session.ts` **and** `prisma/schema.prisma` exist | A1 pushed |
| `B4` | `src/lib/schemas.ts` exists | A1 pushed |
| `B5` | B4 done | |
| `B6` | B5 done | |

**Deadlock check** — A0→A1→A2 need nothing from B; B0→B1→B2 need only A0. By the time A reaches A3, B2
exists; by the time B reaches B3, A1 exists. Both chains always progress.

---

## 5. Rebase conflict recovery

Both lanes push to `main`, so `git pull --rebase` will occasionally conflict. A conflict means someone
touched a file outside their lane — usually a lockfile or a generated file.

```bash
# 1. What conflicted?
git status --short | grep '^UU\|^AA'

# 2. For every conflicted file I DO NOT own → take the other lane's version:
git checkout --theirs <path> && git add <path>
#    (during a rebase, --theirs is the version already on main. That is what you want.)

# 3. For every conflicted file I DO own → keep mine, or hand-merge if both edits are real:
git checkout --ours <path> && git add <path>

# 4. package-lock.json conflicts → always take main's, then re-run npm install:
git checkout --theirs package-lock.json && npm install && git add package-lock.json

git rebase --continue
```

Failed twice in a row?
```bash
git rebase --abort
# wait 60s, then:
git pull --rebase origin main
# re-apply your change on top of the fresh main and commit again
```

**Never `git push --force`. Never `git reset --hard origin/main` while you hold uncommitted work.**
If you are ever unsure, `git stash`, pull cleanly, `git stash pop`, resolve, continue.

---

## 6. The steps

Format: **ID · Title** — Gate · Creates · Build · Accept · Commit.
Status lives in your ledger, not here.

---

### LANE A — foundation + Shipper

---

#### `A0` · Scaffold, database, container, Cloud Build
**Gate:** none. **This step unblocks Lane B — do it in one pass and push immediately.**

**Creates:** `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`,
`.gitignore`, `.env.example`, `Dockerfile`, `.dockerignore`, **`cloudbuild.yaml`**, `.gcloudignore`,
`docs/gcp-setup.md`, `prisma/schema.prisma`, `prisma.config.ts`, `prisma/seed.ts`,
`prisma/migrations/**`, `src/lib/prisma.ts`, `src/lib/format.ts` (+ `format.test.ts`),
`src/app/layout.tsx`, `src/app/page.tsx`,
stubs handed to Lane B: `src/app/globals.css`, `src/components/app-shell.tsx`,
`docs/progress-A.md`, `docs/progress-B.md`.

**Build:**
1. `npx create-next-app@latest` — TypeScript, App Router, Tailwind, ESLint, `src/` dir, alias `@/*`.
   It refuses to run in a non-empty directory, so scaffold into a temp subdir and move the files up;
   delete its generated `CLAUDE.md`, `AGENTS.md`, `README.md` and demo SVGs, and **merge** its `.gitignore`
   into the existing one rather than replacing it (`docs/LANE.md` and `.env*` must survive).
   **Record the resolved versions in TechnicalDocument.md §2.1.**
2. `next.config.ts`: `output: 'standalone'`; **warn** (do not throw) when `DEV_AUTH_BYPASS=true` in a
   production build — see TechnicalDocument.md §4.4 for why the enforcement is at runtime instead.
3. `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`.
4. Install `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `zod`, `firebase`, `firebase-admin`,
   `server-only`, and dev `vitest`, `tsx`, `dotenv`. Do **not** init Shadcn here — B1 generates and rethemes
   its primitives against B0's tokens.
5. `prisma/schema.prisma` — TechnicalDocument.md §3.1 verbatim (indexes and the Google Maps route fields
   included). Prisma 7: generator `prisma-client` with an `output`, datasource carries only `provider`.
6. `prisma.config.ts` — loads `.env.local` via dotenv and points `datasource.url` at `DIRECT_URL`
   (migrations need DDL, which a pooler can't run). CLI-only; the app uses the adapter.
7. `npx prisma migrate dev --name init` against Neon — commit the generated migration.
8. `prisma/seed.ts` — every fixture in TechnicalDocument.md §3.4. Idempotent (delete, then insert).
9. `src/lib/prisma.ts` — `server-only`, `PrismaPg` adapter on the pooled `DATABASE_URL`, singleton guarded
   for dev HMR.
10. `src/lib/format.ts` — `formatINR` (en-IN, no paise), `tonsToKg`/`kgToTons`/`formatWeight`,
    `formatRemaining` (absolute-instant countdown, 30-min urgency), `formatRelativeTime`. Unit-test it.
11. `src/app/layout.tsx` — `next/font` Inter 400/700/800/900, Material Symbols `<link>`, viewport
    `width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover`, `themeColor '#a04100'`,
    manifest link, imports `./globals.css`, wraps `{children}` in `<AppShell>`.
12. `src/app/page.tsx` — redirect to `/login`; A1 makes it session-aware.
13. Stubs for Lane B (§3): `globals.css` containing only `@import "tailwindcss";`, and `app-shell.tsx` as a
    pass-through. Both carry a `// B0 replaces this` comment.
14. `package.json` scripts: exactly the list in CLAUDE.md §2.
15. `.env.example` — every key from TechnicalDocument.md §2.5, including the two Google Maps keys.
16. `Dockerfile` — the three-stage build from TechnicalDocument.md §9.1. `NEXT_PUBLIC_*` values arrive as
    build args; server secrets never do. `.dockerignore` excludes `node_modules`, `.next`, `.env*`, `docs`,
    `*.md`, `src/generated`.
17. **`cloudbuild.yaml`** — build → push to Artifact Registry → `prisma migrate deploy` → deploy to Cloud
    Run, exactly as TechnicalDocument.md §9.2. All secrets come from **Google Secret Manager**: build-time
    `availableSecrets` for the values Next.js inlines into the client bundle, and `--set-secrets` on the
    Cloud Run deploy for runtime server secrets. **No secret value is ever written into the repo, the
    image, or a substitution.** `.gcloudignore` mirrors `.dockerignore`.
18. `docs/gcp-setup.md` — the one-time bootstrap: enable APIs, create the Artifact Registry repo, create
    every Secret Manager secret (TechnicalDocument.md §9.3), grant both service accounts their roles.
19. `docs/progress-A.md`, `docs/progress-B.md` from the templates in §8. `docs/LANE.md` already exists
    locally (written at session start); add it to `.gitignore` — it is per-checkout and must never be
    committed, or the two lanes will fight over its value.

**Accept:** `npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ · `npm run build` ✓ ·
`npm run db:migrate && npm run db:seed` ✓ · `npx prisma studio` shows 5 auctions in mixed states ·
`/` redirects to `/login` · `git check-ignore .env.local docs/LANE.md` matches both ·
`grep -rn "AIza\|BEGIN PRIVATE KEY" cloudbuild.yaml Dockerfile` returns nothing.

**Commit:** `A0: scaffold Next.js, Prisma schema, Docker, Cloud Build, seed data`

---

#### `A1` · Firebase auth + session
**Gate:** none. **Creates:** `src/lib/firebase/clientApp.ts`, `src/lib/firebase/adminApp.ts`,
`src/lib/session.ts`, `src/lib/schemas.ts`, `src/lib/actions/user.ts` *(createSession only)*,
`middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/google-button.tsx`.

**Build:** Firebase client + admin init (admin lazily, from env, tolerant of missing creds in dev).
`createSession(idToken)` server action → `verifyIdToken` → `createSessionCookie` (5d) → upsert `User` by
`firebaseUid` → set `__session` cookie → return `{ role }`. `getSession` / `requireSession` /
`requireRole` per TechnicalDocument.md §4.2, including the `DEV_AUTH_BYPASS` branch (§4.4). `signOut`
clears the cookie and revokes refresh tokens. `middleware.ts` per §4.3 — **cookie-presence check only**,
no Admin SDK on the Edge runtime. `src/lib/schemas.ts` holds every zod schema from §5 (both lanes import
it; B4 needs `SubmitBidSchema` — write it now even though Lane B implements the action).
`/login` from Stitch `23b5db873d684cb1af8e716879c4ab9f`: centered logo, "Find loads. Book trucks.
Instantly.", full-width sticky "Continue with Google" with the G mark, ToS line beneath. The Google button
is the only `"use client"` piece.

**Accept:** `DEV_AUTH_BYPASS=true npm run dev` → `/` routes by mock role · `/shipper` unauthenticated →
`/login` · `/login` renders correctly at 390×844 · production build throws with `DEV_AUTH_BYPASS=true`.

**Commit:** `A1: firebase auth, session cookies, middleware, login screen`

---

#### `A2` · Onboarding & role routing
**Gate:** none. **Creates:** `src/app/(auth)/onboarding/page.tsx`, `.../role-cards.tsx`;
extends `src/lib/actions/user.ts` with `setUserRole`.

**Build:** Stitch `a3fd9497fe1c40d08b56ba95c58202d7`. "Choose your role" / "You can change this later in
settings." Two large vertical selectable cards — Shipper (factory/box icon, "I have material to ship") and
Carrier (semi-truck icon, "I am a Truck Owner"). Selected card: thick `primary-container` border +
checkmark. Sticky full-width "Continue", disabled until a choice is made. `setUserRole` per §5.1 — rejects
if `role` is already set. Landing + login redirect: `role === null → /onboarding`, `SHIPPER → /shipper`,
`CARRIER → /carrier`.

**Accept:** the role-less seed user lands on `/onboarding` · picking a role persists and routes correctly ·
returning to `/onboarding` with a role set redirects away · cards are ≥ 48px tappable, no `md:` classes.

**Commit:** `A2: role selection onboarding and post-login routing`

---

#### `A3` · Shipper dashboard
**Gate:** `src/components/auction-card.tsx` + `src/components/mobile-nav.tsx` exist.
**Creates:** `src/app/(dashboard)/shipper/page.tsx`, `loading.tsx`, `error.tsx`.

**Build:** Stitch `2a58c34ed93845e29def176c80cc2648`. Top bar: avatar + "TruckingGO" wordmark +
notification bell. `<h2>` "Active Auctions". List of `<AuctionCard variant="shipper">` — pulsing LIVE
badge, `<Timer>`, route row, metadata strip with "N Bids" (`primary-container` when > 0, `surface-variant`
when 0). `<MobileNav role="SHIPPER" active="home" />`. `<Fab href="/shipper/create" icon="add" />`. Query
per TechnicalDocument.md §5.6. Cards link to `/shipper/auction/[id]`. Empty state: "No active auctions" +
"Post a Load" CTA. Skeleton in `loading.tsx`.

**Accept:** seeded shipper1 sees 3 active auctions with correct bid counts · Auction 3's timer is red
(< 30 min) · empty state renders for shipper2 after clearing their auctions · 390×844, no horizontal
scroll, nothing hidden behind the nav.

**Commit:** `A3: shipper dashboard with live auction cards`

---

#### `A4` · Create auction with Google Maps route lookup
**Gate:** `src/components/ui/button.tsx` and `src/components/ui/input.tsx` exist (B1 pushed).
**Creates:** `src/app/(dashboard)/shipper/create/page.tsx`, `.../auction-form.tsx`,
`src/components/LocationAutocomplete.tsx` *(Lane A carve-out, §3)*, `src/lib/maps.ts`,
`src/lib/actions/auction.ts` (`calculateRouteAndCreateAuction`), `src/lib/maps.test.ts`.

**Build:** Stitch `5351d3902a5149ed91c6e59678e51bd1` — back arrow + "Post a Load", scrollable form, sticky
full-width "Start Auction Now". Full spec in TechnicalDocument.md §10.

1. **`LocationAutocomplete.tsx`** (§10.3) — `"use client"`, Places Autocomplete via
   `@vis.gl/react-google-maps`, wrapping the project's own `Input` primitive so it inherits the design
   system. `componentRestrictions: { country: 'in' }`. Suggestion rows **≥ 48px**, capped at 4 visible so
   the on-screen keyboard can't bury them, `active:` feedback, no hover-only styling. ~250ms debounce,
   session tokens, `role="combobox"` + arrow-key navigation. Callback
   `onPlaceSelect(address, lat, lng)`. **Degraded mode:** with an empty
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` it becomes a plain text input reporting null coordinates — this is
   what lets the build loop run without a billing-enabled Maps key.
2. **`src/lib/maps.ts`** — `server-only`. `resolveRoute()` calls Distance Matrix with
   `GOOGLE_MAPS_SERVER_API_KEY` via native `fetch`, `cache: 'no-store'`, 10s timeout. **Check both status
   levels** — `json.status` *and* `rows[0].elements[0].status`; an `OK` response can still carry
   `ZERO_RESULTS` per element. Convert metres→km (1dp) and seconds→minutes. Map each failure to the
   user-facing message in §10.2 and never echo a raw Google status or response body.
3. **Form** — two `LocationAutocomplete` instances (Pickup, Drop-off) holding
   `{ address, lat, lng }` in local state, plus Material Description, Weight (Tons), and duration
   `<Chip>`s 1/6/12/24 (6 preselected). Submit button shows a spinner while the server resolves the route —
   this call is slower than a plain insert, so the loading state is required, not optional.
4. **`calculateRouteAndCreateAuction`** (§5.2) — `requireRole('SHIPPER')`, zod parse, `resolveRoute`,
   then `auction.create` with `weightKg = weightTons × 1000` and all six route fields. Revalidate
   `/shipper` and `/carrier`, redirect to the new auction. Return `{ ok: false, error, field }` on failure;
   never throw.
5. If the route lookup fails, **still create the auction** with null route fields (§10.5) and surface a
   non-blocking notice — a load with an unknown distance beats no load.

**Accept:** a submitted form creates a row with correct `weightKg`, `endTime`, coordinates, `distanceKm`
and `estimatedTimeMins` · invalid input shows inline errors and creates nothing · two unroutable points
produce the friendly `ZERO_RESULTS` message · with the Maps key blank the form still works as plain text
inputs and creates an auction with null route fields · suggestion rows are ≥ 48px and stay visible with the
keyboard open at 390×844 · the sticky CTA stays above the home indicator ·
`grep -rn "GOOGLE_MAPS_SERVER_API_KEY" src/app src/components` returns **nothing** (server key must never
appear in client-reachable code) · unit tests cover the metres→km and seconds→minutes conversions and each
error branch.

**Commit:** `A4: create auction with Places autocomplete and Distance Matrix routing`

---

#### `A5` · Shipper auction details + live bids
**Gate:** `src/components/timer.tsx` + `src/components/bid-card.tsx` exist.
**Creates:** `src/app/(dashboard)/shipper/auction/[id]/page.tsx`, `loading.tsx`, `error.tsx`,
`.../accept-bid-sheet.tsx`.

**Build:** Stitch `d8dfb998516d446181dd7245c2c45e7a`. Summary card + large `text-error` countdown
"Time Left: 00h 45m 12s". Section header "Live Bids (N)". `<BidCard>` list: carrier avatar + name, amount
in `display-price` ₹, relative submit time, in-card "Accept Bid" button; lowest carries the "Best Price"
badge. Reduce to **latest bid per carrier**, sort ascending (§3.3). Mount `<PollingRefresher />` (7s).
Accept opens a bottom `Sheet` confirming carrier + amount. Non-ACTIVE auctions render read-only with a
status banner and no accept buttons. 404 if the auction isn't this shipper's.

**Accept:** bids appear within ~7s of another session bidding · Best Price sits on the true minimum · a
carrier who bid twice appears once, at their lower price · closed auction hides accept · another shipper's
auction 404s.

**Commit:** `A5: shipper auction details with live bid list`

---

#### `A6` · Accept-bid transaction + cron
**Gate:** A5 done. **Creates:** `src/lib/actions/auction.ts` (`acceptBid`), `src/app/api/cron/route.ts`,
`docs/cloud-scheduler.md`, `src/lib/__tests__/auction-close.test.ts`.

**Build:** `acceptBid` exactly as TechnicalDocument.md §5.4 — the status-guarded `updateMany` claim,
`claimed.count === 0 → AuctionNoLongerActiveError`, winner ACCEPTED, others REJECTED, Serializable
isolation, all four revalidations. Surface the race loss as
`{ ok: false, error: 'This auction just closed.' }` and refresh the page rather than crashing.
`/api/cron` per §5.5 — timing-safe bearer compare, `force-dynamic`, `{ closed: n }`.
`docs/cloud-scheduler.md`: the `gcloud scheduler jobs create http` command, secret handling, retry policy.

**Accept:** accepting sets 1 ACCEPTED + N REJECTED + auction COMPLETED_ASSIGNED, verified in Prisma Studio ·
accepting an already-expired auction returns the friendly error and changes nothing · cron closes only
expired ACTIVE auctions, never a COMPLETED_ASSIGNED one · cron without a bearer → 401 · second cron call →
`{ closed: 0 }` · unit test covers the close predicate.

**Commit:** `A6: accept-bid transaction and cron auction expiry`

---

#### `A7` · Shipper history + deploy docs
**Gate:** A6 done. **Creates:** `src/app/(dashboard)/shipper/history/page.tsx` + `loading.tsx`,
`docs/deploy.md`; finalizes TechnicalDocument.md §1–§5, §9.

**Build:** Hand-built from the design system (no Stitch screen). `<AuctionCard>` variant with a status chip
— `COMPLETED_ASSIGNED` → `tertiary` "Assigned" + the winning amount; `CLOSED_EXPIRED` → `surface-variant`
"Expired". Newest first. Empty state. Wire `MobileNav`'s History tab.

`docs/deploy.md` — the *operating* guide on top of the `cloudbuild.yaml` that already shipped in A0:
`gcloud builds submit --config cloudbuild.yaml .`, rotating a Secret Manager version, rolling back to a
previous Cloud Run revision, reading build logs, and the TechnicalDocument.md §9.7 release checklist.
Re-verify `cloudbuild.yaml` still matches reality (image tags, the migrate step, the full `--set-secrets`
list) now that all routes exist, and confirm TechnicalDocument.md §2.1 records the real resolved versions.

**Accept:** history shows only terminal auctions with correct chips · assigned rows show the winning ₹ ·
empty state renders · `docs/deploy.md` commands are copy-pasteable · `cloudbuild.yaml` lists every secret
in TechnicalDocument.md §9.3 · `grep -rn "AIza\|BEGIN PRIVATE KEY\|postgresql://" --include=*.yaml --include=Dockerfile .`
finds only the documented build placeholder.

**Commit:** `A7: shipper history screen and deployment docs`

---

### LANE B — design system + Carrier

---

#### `B0` · Design tokens, global styles, PWA shell
**Gate:** `package.json` exists.
**Creates:** `src/lib/design/tokens.ts`, `public/manifest.json`, `public/icons/*`;
**overwrites** `src/app/globals.css` and `src/components/app-shell.tsx` (both are A0 stubs — replace
wholesale, preserve nothing).

**Build:**
1. Port the **exact** token set from CLAUDE.md §4.1–§4.3 into an `@theme { }` block in `globals.css` —
   **Tailwind v4 is CSS-first and there is no `tailwind.config.ts`** (TechnicalDocument.md §2.4 shows the
   `--color-* / --spacing-* / --radius-* / --text-*` naming). **No value may differ from the table by a
   single digit**, and no PRD §6 hex (`#FF6B00`, `#0F172A`, `#F8FAFC`, `#020617`, `#10B981`, `#EF4444`)
   may appear anywhere. Safe-area insets come from `env(safe-area-inset-*)` utilities you define in the
   same file — do not add a plugin.
2. `globals.css`: `@tailwind` layers, tokens mirrored as CSS custom properties, Material Symbols font-face
   + `.material-symbols-outlined` base class, `html/body { overscroll-behavior: none; overflow-x: hidden;
   -webkit-tap-highlight-color: transparent; touch-action: manipulation; }`, `::selection`,
   `@media (prefers-reduced-motion: reduce)` killing `animate-ping`.
3. `src/components/app-shell.tsx` — real implementation: viewport-locked wrapper, safe-area padding, the
   §7.1 geometry, slots for header / main / bottom nav.
4. `public/manifest.json` + icons (192, 512, maskable, apple-touch) derived from the Stitch logo screen
   `70b66552da1549d8a24ee67735b7e067`. Values per TechnicalDocument.md §7.2.
5. `src/lib/design/tokens.ts` — the same values as typed TS constants.
6. `docs/stitch-screens.md` — screen ID → route → owning step (the §6.3 table).

**Accept:** `npm run build` ✓ · a scratch page using `bg-primary-container`, `text-display-price`,
`p-margin-mobile`, `rounded-lg` renders with the right values · `grep -rn "#FF6B00\|#0F172A\|#10B981\|#EF4444" src/`
returns nothing · manifest validates and the PWA installs at 390×844 · no horizontal scroll, no body bounce.

**Commit:** `B0: design tokens, global styles, PWA manifest and app shell`

---

#### `B1` · UI primitives
**Gate:** B0 done (`@theme` block present in `globals.css`). **Creates:** `src/components/ui/{button,input,card,chip,badge,avatar,sheet,skeleton,empty-state}.tsx`.

**Build:** Generate Shadcn primitives where one exists, then **retheme completely** — repoint
`--primary`/`--destructive` at `primary-container`/`error` and delete every trace of Shadcn's stock slate
palette. Props per TechnicalDocument.md §6.2. Non-negotiables: `Button` primary =
`bg-primary-container text-on-primary-container`, sticky variant is full-width `h-14 rounded-lg`, with a
`loading` state; `Input` is `h-touch-target-min` with 16px text (smaller text triggers iOS zoom); `Card` is
the §4.4 recipe verbatim; `Sheet` slides from the **bottom** only — a centered modal is a bug;
`EmptyState` requires `icon`, `title`, `body`, and an optional CTA.

**Accept:** every primitive renders on a scratch page in both light and dark · every interactive primitive
is ≥ 48px and has `active:` feedback · no `md:`/`lg:` anywhere · `npm run typecheck` ✓ · no raw hex.

**Commit:** `B1: themed UI primitives`

---

#### `B2` · Shared components
**Gate:** B1 done. **Creates:** `src/components/{mobile-nav,timer,auction-card,route-row,bid-card,fab,polling-refresher}.tsx`.
**This step opens Lane A's A3 and A5 gates — push promptly.**

**Build:**
- `MobileNav` — role-aware, fixed, `h-16`, `pb-safe`, 3 items. SHIPPER: Home/History/Profile
  (`home`/`history`/`person`). CARRIER: Find Loads/My Bids/Profile (`search`/`gavel`/`person`).
  Active = `text-primary` + `FILL 1`; inactive = `text-secondary` + `FILL 0`. Labels use `label-bold`.
- `Timer` — **the correctness-critical one.** Implement TechnicalDocument.md §7.3 exactly: absolute ISO
  `endTime` prop, recompute from `Date.now()` each tick (never decrement a counter), `02h 14m` / `45m 12s`
  / `00m 09s` formats, `text-error` at ≤ 30 min, "Expired" + one `router.refresh()` at zero, no hydration
  mismatch, `aria-live="off"` with a descriptive `aria-label`.
- `AuctionCard` — the §4.4 card recipe. `variant="shipper"` shows the bid-count badge;
  `variant="carrier"` shows distance/weight and a "View & Bid" button. LIVE badge with the pulsing dot.
- `RouteRow`, `BidCard` (₹ in `display-price`, `tertiary` when ACCEPTED, `isBest` → "Best Price" badge),
  `Fab`, `PollingRefresher` (7s, visibility-aware, per §7.4).
- Unit tests for the timer formatter across all boundaries in §8.1.

**Accept:** `npm run test` ✓ · timer stays accurate after backgrounding the tab 2 min · timer flips red
under 30 min and reads "Expired" at zero · nav highlights the right tab for both roles · `PollingRefresher`
fires only while visible (verify in the Network panel) · reduced-motion stops the ping.

**Commit:** `B2: shared components — nav, timer, cards, polling`

---

#### `B3` · Carrier load feed
**Gate:** `src/lib/session.ts` + `prisma/schema.prisma` exist.
**Creates:** `src/app/(dashboard)/carrier/page.tsx`, `loading.tsx`, `error.tsx`, `.../feed-filters.tsx`.

**Build:** Stitch `36d28947d9c84715a0d418d3c0a5e2e9`. Search bar with a `tune` filter icon. Horizontally
scrollable `<Chip>` row: All / Nearby / Expiring Soon / High Weight (single-select, "All" default; chip
state in the URL via `searchParams` so it survives `router.refresh()`). Feed of
`<AuctionCard variant="carrier">` — cities, material/weight, red countdown, "View & Bid". Query per
TechnicalDocument.md §5.6 (`ACTIVE` **and** `endTime > now`). Filters: *Expiring Soon* = `endTime` within
1h; *High Weight* = `weightKg >= 10000`; *Nearby* = **still disabled** — `distanceKm` is the *route's* length,
not the carrier's proximity to the pickup, and we store no carrier location. Render it disabled with a
"Coming soon" affordance; do not repurpose route distance (TechnicalDocument.md §10.4).
Cards now show real route data where present: "148 km · ~3h 15m". All six route fields are **nullable** —
render "Distance unavailable" when they are null, never `undefined km`. `<MobileNav role="CARRIER"
active="find" />`. `<PollingRefresher />`. Empty state: "No loads available right now".

**Accept:** carrier1 sees the 3 active auctions, expired/assigned ones absent · each chip filters correctly
and survives a refresh · Nearby is visibly disabled, not fabricated · empty state renders · chip row scrolls
horizontally without the page scrolling.

**Commit:** `B3: carrier load feed with filters`

---

#### `B4` · Place a bid
**Gate:** `src/lib/schemas.ts` exists.
**Creates:** `src/app/(dashboard)/carrier/auction/[id]/page.tsx`, `loading.tsx`, `error.tsx`,
`.../bid-form.tsx`, `.../bid-success.tsx`; `src/lib/actions/bid.ts`.

**Build:** Stitch `69e048b55c6a46a78c57fff5d52fdf6e`. Top card: route, material, ticking `<Timer>`, and the
**route distance + estimated driving time** (`distanceKm`, `estimatedTimeMins`) — this is what lets a
carrier price the job, so treat it as required content, with a graceful fallback when the fields are null
(TechnicalDocument.md §10.4). Middle:
large centered numeric input with a **₹** prefix, `inputMode="decimal"`. Below it: "Current lowest bid is
₹42,000" (or "Be the first to bid"). Sticky footer: "Bids cannot be canceled once submitted" + a massive
full-width "Submit Bid". Confirm in a bottom `Sheet` before writing. Success → Stitch
`16fc1711669148ceac2c4d7f91f79014` (check mark, amount, "Back to Loads").
`submitBid` implements **all six guards** in TechnicalDocument.md §5.3 — especially #4 (`endTime > now`,
never trusting the client timer), #5 (not your own load) and #6 (must undercut your own previous bid) —
plus every revalidation listed. `<PollingRefresher />` keeps "current lowest" fresh.

**Accept:** a valid bid persists and shows the success screen · bidding on an expired auction is rejected
server-side even with the UI forced open · a shipper account cannot bid · bidding on your own load is
rejected · a second bid must be lower or it's rejected with an inline message · the shipper's detail page
shows the new bid within ~7s · CTA stays reachable with the numeric keyboard open at 390×844.

**Commit:** `B4: carrier bid submission with guards and success screen`

---

#### `B5` · My Bids
**Gate:** B4 done. **Creates:** `src/app/(dashboard)/carrier/bids/page.tsx` + `loading.tsx`.

**Build:** Hand-built (no Stitch screen) — compose from B1/B2 primitives, per CLAUDE.md §4.6. Segmented
control: Pending / Won / Lost, mapping to `PENDING` / `ACCEPTED` / `REJECTED`, selection in `searchParams`.
Each row: route, my amount in `display-price`, submitted-at, and a status chip — Pending `primary` +
live timer if the auction is still ACTIVE; Won `tertiary` "Won"; Lost `surface-variant` "Lost"; and for a
PENDING bid on a `CLOSED_EXPIRED` auction, `surface-variant` "Auction expired" (nobody won — see
TechnicalDocument.md §5.5). Never signal by color alone (§7.7). Query per §5.6. Per-tab empty states.

**Accept:** the seeded carriers show a bid in each of the four situations · counts match Prisma Studio ·
tab selection survives refresh · every status reads as text as well as color.

**Commit:** `B5: my bids screen with status segmentation`

---

#### `B6` · Profile, state coverage, a11y pass
**Gate:** B5 done. **Creates:** `src/app/(dashboard)/profile/page.tsx`, `.../sign-out-button.tsx`;
audits every screen; finalizes TechnicalDocument.md §6–§8.

**Build:** Hand-built profile: avatar, name, email, role badge, and a sign-out button in a bottom `Sheet`
confirm (calls Lane A's `signOut`). Then sweep **every** screen in the app, both lanes':
each list has `loading.tsx` (Skeleton matching real card geometry), `error.tsx` (message + "Try again"
via `reset()`), and an `EmptyState`; add the offline banner from §7.5; add `aria-label` to every icon-only
button; verify contrast pairings; verify `prefers-reduced-motion`. Fix any state gap **in Lane B's files
only** — a gap in a Lane A screen goes in `docs/progress-B.md` under `HANDOFF TO A`.

**Accept:** `grep -rn "\b\(sm\|md\|lg\|xl\):" src/` returns nothing · every route has loading + error ·
every icon-only button has a label · reduced-motion disables the ping · the full §8.3 end-to-end scenario
passes · PWA installs and runs standalone.

**Commit:** `B6: profile screen, full state coverage, accessibility pass`

---

## 7. Completion

When every step in your lane is `DONE`:

1. `git pull --rebase origin main` and run the full Definition of Done against `main` as it now stands.
2. Run the end-to-end scenario in TechnicalDocument.md §8.3 top to bottom.
3. Write a closing entry in your ledger: what shipped, what's deferred, any `HANDOFF` items still open.
4. If the other lane still has open steps, **stop and idle** — pull every 5 minutes and re-run §8.2's
   mobile checklist against their newly landed screens, reporting (not fixing) anything broken via your
   ledger. Do not start their work.
5. When both lanes are `DONE`, the last one to finish appends a `## v1 complete` section to
   `docs/progress-<lane>.md` listing the deferred backlog (Nearby/geo filtering, notifications, service
   worker, dark-mode verification, ratings).

---

## 8. Ledger templates

**`docs/LANE.md`** — written by the agent at session start (§0) from the user's answer to "which Claude am
I?". One line, nothing else:

```markdown
LANE: A          # Claude 1 → Lane A (foundation + Shipper).  Claude 2 → "LANE: B".
```

It is a **per-checkout** file — each of the two working copies holds its own value — so it is listed in
`.gitignore` and never committed. If it is missing or empty, ask; never guess.

**`docs/progress-A.md` / `docs/progress-B.md`**

```markdown
# Lane <X> Progress

| Step | Status | Commit | Notes |
|------|--------|--------|-------|
| X0   | TODO   |        |       |

Status: TODO · IN_PROGRESS · DONE · BLOCKED(<gate>)

## DEPS REQUESTED   (Lane B only — packages for Lane A to install)
## HANDOFF TO <other lane>
## Blockers log
<timestamp> — waiting on <gate>; re-checking in 60s
```

---

## 9. Rules that cannot be bent

0. Ask which Claude you are at session start (§0). Never guess your lane.
1. Never edit a file outside your ownership list (§3).
2. Never work the other lane's step, even to unblock yourself.
3. Never commit with a failing `build`, `typecheck`, or `lint`.
4. Never force-push; never rewrite pushed history.
5. One step, one commit, one push.
6. After §0, never stop to ask the user. A gate that isn't open is a 60-second wait, not a question.
7. Never add a `md:`/`lg:` breakpoint, a raw hex, or a desktop layout. This is a mobile app.
