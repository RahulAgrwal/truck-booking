# CLAUDE.md — TruckingGO Operating Manual

> This file is loaded into every Claude session in this repo. Read it fully before touching code.
> Companion documents: [`TruckingGO_Master_PRD.md`](./TruckingGO_Master_PRD.md) (product intent) ·
> [`TechnicalDocument.md`](./TechnicalDocument.md) (how it works) · [`BuildPlan.md`](./BuildPlan.md) (what to build next).

---

## 0. STOP — ask which Claude you are, before anything else

**Two Claude instances build this repo in parallel.** The very first thing you do in a new session — before
reading code, before running a command, before touching a single file — is **ask the user which instance
you are**, using `AskUserQuestion`:

> **"Which Claude am I in this session?"**
> · **Claude 1 → Lane A** — foundation, auth, Shipper vertical, cron, deploy (steps `A0`–`A7`)
> · **Claude 2 → Lane B** — design system, shared components, Carrier vertical (steps `B0`–`B6`)

Do not guess. Do not infer it from the working directory, the git history, or which files happen to exist.
Two instances that both think they are Lane A will overwrite each other's work on `main`.

Once the user answers:

1. Write the answer into [`docs/LANE.md`](./docs/LANE.md) (`LANE: A` or `LANE: B`) so a context compaction
   or a mid-session restart can recover it without asking again.
2. Read your own ledger — `docs/progress-A.md` or `docs/progress-B.md`.
3. Open [`BuildPlan.md`](./BuildPlan.md) and take the **first `TODO` step in your lane whose gate is satisfied**.

**The one exception:** if `docs/LANE.md` already says `LANE: A` or `LANE: B` *and* the matching ledger shows
in-progress work from this same checkout, you are resuming — confirm it in one line ("Resuming as Claude 1 /
Lane A at step A3") and continue without asking. If there is any ambiguity at all, ask.

This is the only moment in the entire build where you stop for the user. Every step after this runs
autonomously.

Two rules that override everything else in this file:

- **Never work a step belonging to the other lane.** Not even a small one. Not even if it looks blocked.
- **Never create or edit a file outside your lane's ownership list** (BuildPlan.md §3). If your step seems
  to require a file the other lane owns, the step is mis-scoped — record the blocker in your ledger,
  skip to your next eligible step, and keep looping.

You run autonomously. You do not stop to ask the user for approval between steps.

---

## 1. What this is

TruckingGO is a **mobile logistics marketplace** built as a Next.js PWA. Shippers post loads as
**time-boxed reverse auctions**; carriers (truck owners) bid the price *down*; the auction locks when the
shipper accepts a bid or the timer expires — whichever comes first.

Two roles, two entirely separate app surfaces sharing one design system:

| Role | Surface | Core job |
|---|---|---|
| `SHIPPER` | `/shipper/*` | Post a load, watch bids arrive live, accept one |
| `CARRIER` | `/carrier/*` | Scan the load feed, check the countdown, submit a bid |

**Current state:** `A0` is complete — Next.js 16.3.0 + Prisma 7 + Tailwind v4 scaffold, schema migrated
and seeded against Neon, `Dockerfile` and `cloudbuild.yaml` ready. Lane B's `B0` gate is open. Live status
is in `docs/progress-A.md` / `docs/progress-B.md`.

---

## 2. Commands

```bash
npm run dev              # Next.js dev server on :3000
npm run build            # production build — MUST pass before any commit
npm run start            # run the production build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit — MUST pass before any commit
npm run test             # vitest (unit: timer math, auction close logic, zod schemas)

npm run db:generate      # prisma generate (also runs on postinstall)
npm run db:migrate       # prisma migrate dev
npm run db:deploy        # prisma migrate deploy (CI/prod)
npm run db:seed          # reset + reseed demo data — TRUNCATES, see below
npm run db:studio        # prisma studio

docker build .                                    # verify the Cloud Run image builds
gcloud builds submit --config cloudbuild.yaml .   # build → migrate → deploy to Cloud Run
```

Development runs against the **Neon** database directly (no Docker — see TechnicalDocument.md §2.2), with
`DEV_AUTH_BYPASS=true` in `.env.local` supplying a mock session so no Firebase credentials are needed.

> ⚠️ **Both lanes share one Neon database.** `npm run db:seed` truncates all three tables. Reseed only when
> your own step needs it; if rows vanish mid-step, the other lane reseeded — re-seed and re-check before
> reporting a bug.

---

## 3. Hard rules — non-negotiable

### 3.1 This is a mobile app. Not a responsive website.

The Stitch designs are 780×1768 mobile frames. The product is a PWA that must feel native.

- **No `sm:` / `md:` / `lg:` / `xl:` breakpoints. Ever.** If you type `md:` you have made a mistake.
- **No desktop layout, no sidebar, no multi-column grid.** One column, top to bottom.
- **No hover-only affordances.** Hover does not exist on a phone. Use `active:` for press feedback
  (`active:scale-[0.98]` on cards, `active:scale-95` on buttons, `active:opacity-80` on icon buttons).
- Every interactive element is **≥ 48px** on its smallest axis (`h-touch-target-min`).
- The app renders inside a **viewport-locked shell**: fixed top app bar, fixed bottom nav, only `<main>`
  scrolls. Body never scrolls horizontally and never rubber-bands (`overscroll-behavior: none`).
- Respect the notch and home indicator: `viewport-fit=cover` + `env(safe-area-inset-*)` via the
  `pt-safe` / `pb-safe` utilities. The bottom nav carries `pb-safe`.
- Ships as an installable PWA: `display: standalone`, portrait-primary, themed status bar.
- **Verify every screen at 390×844** (iPhone 14) before you call a step done. Nothing else matters.

### 3.2 Server-first data flow

- **React Server Components by default.** Add `"use client"` only for: countdown timers, forms with local
  state, filter chips, the polling refresher, and the Firebase sign-in button. Nothing else.
- **Prisma is server-only.** `src/lib/prisma.ts` must never appear in a client component's import graph.
  If you need data in a client component, pass it as a serialized prop from a Server Component.
- **All mutations are Server Actions** in `src/lib/actions/*.ts`. No API routes for mutations
  (`/api/cron` is the sole exception — it exists for Cloud Scheduler, not for the app).
- Every Server Action opens with the same three lines, in this order:
  1. `const session = await requireSession()` — throws/redirects if unauthenticated
  2. role guard — `if (session.role !== 'SHIPPER') return { ok: false, error: ... }`
  3. `const parsed = Schema.safeParse(input)` — zod, always
- **Never trust the client** for `userId`, `role`, prices, auction status, or whether a timer has expired.
  The client's countdown is a *display*; the server re-checks `endTime` on every write.

### 3.3 Design tokens only

No raw hex values. No arbitrary spacing (`p-[13px]`). No font sizes outside the type scale. If a token you
need doesn't exist, it belongs in the `@theme` block of `src/app/globals.css` — **Tailwind v4 is CSS-first;
there is no `tailwind.config.ts`** (TechnicalDocument.md §2.4). That file is Lane B's, so record the need
as a blocker rather than inventing a one-off.

---

## 4. Design system

**Source of truth: the generated HTML in Stitch project `5704144700317982042`, not PRD §6.** The PRD's
palette (`#FF6B00` + navy `#0F172A`, Lucide icons) was superseded by the Material-3 token set the Stitch
screens were actually built with. Where they disagree, Stitch wins.

### 4.1 Color tokens

| Token | Hex | Used for |
|---|---|---|
| `primary` | `#a04100` | Brand text, wordmark, active nav, timer digits |
| `primary-container` | `#ff6b00` | FAB, primary buttons, bid-count badge — **the safety orange** |
| `on-primary-container` | `#572000` | Text/icon on safety orange |
| `on-primary` | `#ffffff` | Text on `primary` |
| `primary-fixed` | `#ffdbcc` | Tinted press states |
| `primary-fixed-dim` / `inverse-primary` | `#ffb693` | Dark-mode brand text |
| `on-primary-fixed` | `#351000` | |
| `on-primary-fixed-variant` | `#7a3000` | |
| `secondary` | `#565e74` | Inactive nav labels, muted meta |
| `secondary-container` / `secondary-fixed` | `#dae2fd` | |
| `secondary-fixed-dim` | `#bec6e0` | Dark-mode inactive nav |
| `on-secondary` | `#ffffff` | |
| `tertiary` | `#006c49` | Accepted / won state text |
| `tertiary-container` | `#00ae78` | Success fills |
| `on-tertiary` | `#ffffff` | |
| `on-tertiary-container` | `#003925` | |
| `error` | `#ba1a1a` | LIVE badge, expiring timer, destructive |
| `error-container` | `#ffdad6` | Error banners |
| `on-error-container` | `#93000a` | |
| `on-error` | `#ffffff` | |
| `background` / `surface` / `surface-bright` | `#f7f9fb` | App canvas, top bar, bottom nav |
| `surface-container-lowest` | `#ffffff` | **Card background** |
| `surface-container-low` | `#f2f4f6` | Inset metadata strip inside cards |
| `surface-container` | `#eceef0` | |
| `surface-container-high` | `#e6e8ea` | |
| `surface-container-highest` / `surface-variant` | `#e0e3e5` | Card border, neutral chip fill |
| `surface-dim` | `#d8dadc` | Dark-mode top bar |
| `on-background` / `on-surface` | `#191c1e` | Primary text |
| `on-surface-variant` | `#5a4136` | Secondary text, metadata |
| `outline` | `#8e7164` | Dividers, route connector line |
| `outline-variant` | `#e2bfb0` | Top bar bottom border |
| `inverse-surface` | `#2d3133` | Toasts/snackbars |
| `inverse-on-surface` | `#eff1f3` | Text on toasts |
| `surface-tint` | `#a04100` | |

### 4.2 Type scale — Inter (400 / 700 / 800 / 900)

| Token | Size / line-height / weight | Used for |
|---|---|---|
| `label-bold` | 12 / 16 / 700 | Badges, nav labels, "REMAINING", uppercase micro-copy |
| `body-md` | 14 / 20 / 400 | Card metadata, secondary copy |
| `body-lg` | 16 / 24 / 400 | Body text, input values |
| `timer-md` | 18 / 24 / 800 | Countdown timers |
| `headline-md` | 20 / 28 / 700 | City names, section headers |
| `headline-lg` | 24 / 32 / 700 | Screen titles, wordmark |
| `display-price` | 32 / 40 / 900 / `-0.02em` | Bid amounts |

Apply as a pair: `font-headline-md text-headline-md`.

### 4.3 Spacing & radius

```
unit 4px · stack-sm 8px · gutter-mobile 12px · stack-md 16px
margin-mobile 16px · stack-lg 24px · touch-target-min 48px

radius: DEFAULT 0.25rem · lg 0.5rem · xl 0.75rem · full 9999px
```

Screen horizontal padding is always `px-margin-mobile`. Vertical rhythm between cards is `space-y-stack-md`.

### 4.4 Component recipes (lifted verbatim from the Stitch output)

**Card**
```html
class="bg-surface-container-lowest border border-surface-variant rounded-lg p-stack-md
       shadow-[0_4px_12px_rgba(0,33,83,0.08)] active:scale-[0.98] transition-transform"
```

**App shell**
```html
header  → fixed top-0 w-full z-50 h-touch-target-min bg-surface
          border-b border-outline-variant px-margin-mobile flex justify-between items-center
main    → pt-[calc(48px+24px)] pb-[calc(64px+24px)] px-margin-mobile space-y-stack-md
nav     → fixed bottom-0 w-full z-50 h-16 pb-safe bg-surface
          shadow-[0_-2px_10px_rgba(0,0,0,0.08)] flex justify-around items-center
FAB     → fixed bottom-[calc(64px+16px)] right-4 w-14 h-14 rounded-full
          bg-primary-container text-on-primary-container shadow-lg z-40 active:scale-95
```

**LIVE badge** — a pulsing dot, not a static pill:
```html
<span class="relative flex h-3 w-3">
  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
  <span class="relative inline-flex rounded-full h-3 w-3 bg-error"></span>
</span>
<span class="font-label-bold text-label-bold text-error uppercase tracking-wider">Live</span>
```

**Route row** — origin, hairline connector with a centered arrow, destination:
```html
<div class="flex items-center justify-between relative">
  <span class="font-headline-md text-headline-md text-on-surface">Mumbai, MH</span>
  <div class="flex-1 px-4 relative flex items-center justify-center">
    <div class="h-px bg-outline w-full absolute top-1/2 -translate-y-1/2"></div>
    <span class="material-symbols-outlined text-outline bg-surface-container-lowest px-1 z-10"
          style="font-variation-settings:'FILL' 1">arrow_right_alt</span>
  </div>
  <span class="font-headline-md text-headline-md text-on-surface">Pune, MH</span>
</div>
```

**Metadata strip** — inset row at the card foot: `bg-surface-container-low p-3 rounded`, icon + text on the
left, bid-count badge on the right (`bg-primary-container text-on-primary-container` when > 0,
`bg-surface-variant text-on-surface-variant` when 0).

### 4.5 Icons

**Material Symbols Outlined** — loaded as a font, not a React package. Do **not** install Lucide; the PRD's
mention of it is superseded.

```html
<span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0">home</span>
```
`FILL 0` = inactive/outline, `FILL 1` = active/selected. Used across the app:
`home · history · person · notifications · add · arrow_right_alt · local_shipping · weight · search ·
tune · schedule · check_circle · arrow_back`.

### 4.6 Building a screen that isn't in Stitch

Three screens are not designed (`/carrier/bids`, `/shipper/history`, `/profile`). Compose them from the
primitives above — do **not** generate new Stitch screens and do not invent new visual language.
Pattern references, if you need a shape to copy:
[segmented browse](https://mobbin.com/screens/8de18ab2-04b7-4127-87e6-4781495654f5) ·
[status list with deadline](https://mobbin.com/screens/61cab6cc-d6dd-4010-b2ff-7d21f5531ca7) ·
[decision card with time-left](https://mobbin.com/screens/c1737479-f19d-4533-afbe-6801a20edf77) ·
[filter chips over a feed](https://mobbin.com/screens/ec7011ae-d011-456c-9975-c4071a90a08e).

---

## 5. Architecture map

```
src/
  app/
    layout.tsx                    [A] root: fonts, viewport, PWA meta, shell
    page.tsx                      [A] landing → redirect by session/role
    globals.css                   [B] @theme tokens (Tailwind v4), safe-area, overscroll
    (auth)/
      login/page.tsx              [A] Stitch: Splash & Login
      onboarding/page.tsx         [A] Stitch: Role Selection
    (dashboard)/
      shipper/
        page.tsx                  [A] Stitch: Shipper Dashboard
        create/page.tsx           [A] Stitch: Create Auction Form
        auction/[id]/page.tsx     [A] Stitch: Shipper Auction Details
        history/page.tsx          [A] hand-built
      carrier/
        page.tsx                  [B] Stitch: Carrier Load Feed
        auction/[id]/page.tsx     [B] Stitch: Place a Bid + Bid Confirmation
        bids/page.tsx             [B] hand-built (My Bids)
      profile/page.tsx            [B] hand-built
    api/cron/route.ts             [A] Cloud Scheduler → close expired auctions
  components/
    ui/*                          [B] Button, Input, Card, Chip, Badge, Avatar, Sheet, Skeleton, EmptyState
    LocationAutocomplete.tsx      [A] ⚠ carve-out: Lane A owns this one file in B's tree
    mobile-nav.tsx                [B] role-aware bottom nav
    timer.tsx                     [B] countdown from absolute endTime
    auction-card.tsx              [B] used by both dashboards
    bid-card.tsx  route-row.tsx  fab.tsx   [B]
  generated/prisma/             [A] Prisma 7 client — GITIGNORED, built by postinstall
  lib/
    prisma.ts                     [A] singleton (pg driver adapter)
    maps.ts                       [A] Distance Matrix — SERVER key, server-only
    session.ts                    [A] getSession / requireSession / requireRole
    firebase/clientApp.ts         [A]
    firebase/adminApp.ts          [A]
    actions/
      user.ts                     [A] setUserRole
      auction.ts                  [A] createAuction, acceptBid
      bid.ts                      [B] submitBid
    design/                       [B] token constants shared with TS
  middleware.ts                 [A] session gate (must be under src/, not repo root)
prisma/schema.prisma              [A]
```
`[A]` / `[B]` = owning lane. The authoritative ownership table lives in BuildPlan.md §3.

**Data flow.** Server Component → `prisma` → render. Mutation → Server Action → zod + guards →
`prisma` (transaction where needed) → `revalidatePath` → RSC re-render. Live bids are **polled**
(`router.refresh()` every 7s while the tab is visible), not websocketed — see TechnicalDocument.md §7.4.

---

## 6. Conventions

- **Server Action return shape** — never throw for expected failures:
  ```ts
  type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: string; field?: string };
  ```
- **Files** `kebab-case.tsx`. **Components** `PascalCase`. **Actions** `camelCase` verbs.
- **Money** stored as `Float` per the PRD schema; formatted with
  `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
  **The app is INR (₹).** The Stitch mockups show `$450` — that is cosmetic drift in the mockup, not spec.
- **Weight** — the schema field is `weightKg` (PRD-mandated, do not rename). The **UI collects Tons** and
  converts `tons × 1000` at the Server Action boundary; display converts back.
- **Dates** — always pass absolute ISO strings to the client. Never a precomputed "2h 14m" duration:
  RSC payloads are cached and the string goes stale.
- `revalidatePath` every route whose data a mutation touches — a new bid invalidates both the carrier feed
  and the shipper's auction detail page.
- **Every list screen ships three states**: loading (`Skeleton`), empty (`EmptyState` with a CTA), and
  error. A screen with only the happy path is not done.
- No `any`. No `@ts-expect-error` without a comment naming the reason.

---

## 7. Git protocol

Both lanes commit directly to `main`. There are no feature branches and no PRs.

```bash
git pull --rebase origin main     # before you start a step
# ... implement, verify ...
git add -A
git commit -m "A3: shipper dashboard"     # "<StepID>: <short summary>"
git pull --rebase origin main     # again — the other lane has been pushing
git push origin main
```

**Rebase conflict recovery** (full procedure in BuildPlan.md §5): a conflict means you touched a file the
other lane owns. Take **their** version of anything you don't own, keep yours only for files in your
ownership list, `git rebase --continue`. Two failed attempts → `git rebase --abort`, wait, pull, re-apply.
**Never force-push. Never `git reset --hard` on shared history.**

---

## 8. MCP resources

**Stitch** — project `5704144700317982042` ("TruckingGO Logistics Marketplace").
Screen IDs and their target routes are in [`docs/stitch-screens.md`](./docs/stitch-screens.md).
`mcp__stitch__list_screens` returns fresh signed `downloadUrl`s for each screen's HTML — **the download
URLs expire, so re-list rather than reusing an old URL.** Read the HTML for exact classes; do not eyeball
the screenshot.

**Mobbin** — `mcp__mobbin__search_screens` / `search_flows`, for pattern reference when composing one of
the three undesigned screens. Reference, not source of truth: the tokens in §4 always win.

---

## 9. Security

- Session is an HttpOnly, Secure, SameSite=Lax cookie holding a **Firebase session cookie**
  (`createSessionCookie`), never a raw ID token, never a JWT you minted.
- `/api/cron` requires `Authorization: Bearer ${CRON_SECRET}`; compare in constant time; return 401
  otherwise. It is the one route middleware must let through unauthenticated.
- Only `NEXT_PUBLIC_FIREBASE_*` values may carry the `NEXT_PUBLIC_` prefix. `DATABASE_URL`,
  `FIREBASE_ADMIN_*`, and `CRON_SECRET` must never reach the client bundle — audit before each commit.
- **Two Google Maps keys, never interchangeable.** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is the *client* key
  (Places Autocomplete); it ships in the browser bundle by design and is defended by HTTP-referrer
  restrictions. `GOOGLE_MAPS_SERVER_API_KEY` is the *server* key (Distance Matrix); it must never carry a
  `NEXT_PUBLIC_` prefix, never be a Docker build arg, and never be imported into a client component —
  `NEXT_PUBLIC_` is an instruction to publish the value, not a naming style. Before committing anything
  that touches Maps, run `grep -rn "GOOGLE_MAPS_SERVER_API_KEY" src/app src/components` and expect no hits.
  See TechnicalDocument.md §10.1.
- **Every deployed secret comes from Google Secret Manager** (TechnicalDocument.md §9.3). No secret value
  is ever committed, written into `cloudbuild.yaml`, passed as a Cloud Build substitution, or baked into an
  image layer. Only the four `NEXT_PUBLIC_FIREBASE_*` client keys are build-time args — because Next.js
  inlines them into the bundle — and they are public by design. Server secrets are mounted at **runtime**
  via `--set-secrets`.
- `DEV_AUTH_BYPASS` must hard-fail the build when `NODE_ENV === 'production'`.
- Authorization is checked on the **server**, per action, every time. Hiding a button is not a permission.

---

## 10. Definition of Done

A step is done only when **all** of these hold:

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` succeeds
- [ ] Screen verified at **390×844**, no horizontal scroll, all tap targets ≥ 48px
- [ ] Loading, empty, and error states exist for any list
- [ ] No `md:`/`lg:` breakpoints, no raw hex, no `any`
- [ ] Only files in your lane's ownership list were changed
- [ ] `docs/progress-<lane>.md` updated with status + commit sha
- [ ] Committed and pushed to `main`

Then immediately begin the next eligible step. Do not stop. Do not wait for the user.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
