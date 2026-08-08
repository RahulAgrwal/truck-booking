# TruckingGO — Technical Document

**Version:** 1.0 · **Status:** authoritative · **Supersedes:** `TruckingGO_Master_PRD.md` wherever the two disagree.

This document settles every decision the PRD left open, so that two independent Claude instances building
in parallel arrive at the same system. If you are about to invent an answer to something, look here first.

**Section ownership** (both lanes edit this file, so edits are partitioned):
§1–§5 and §9 → **Lane A** · §6–§8 → **Lane B** · §0 → whoever finds a defect.

---

## 0. Decisions that override the PRD

| # | PRD says | We do | Why |
|---|---|---|---|
| D1 | Palette `#FF6B00` + navy `#0F172A`, Lucide icons (§6) | Material-3 token set from the Stitch build; Material Symbols font | The 8 screens were actually generated against the M3 tokens. Re-coloring them by hand would guarantee drift between the two lanes. |
| D2 | Schema exactly as written (§3) | Same models/fields **verbatim**, plus three indexes | Every list query in the app is unindexed as written. Indexes are additive and change no application semantics. |
| D3 | "Live bids" | 7-second polling via `router.refresh()` | No websocket/realtime service exists in the stack (Cloud Run + Neon + RSC). Polling is the honest implementation. |
| D4 | `weightKg: Float` | Keep the field name; UI collects **Tons**, converts ×1000 server-side | PRD mandates the schema; the designs say "5 Tons". Both can be true with a boundary conversion. |
| D5 | Mockups show `$450` | Currency is **INR (₹)** | Routes are Mumbai→Pune, Delhi→Jaipur, weights in Tons. The `$` in the mockup is Stitch's placeholder. |
| D6 | Session via cookie (§5) | Firebase Admin `createSessionCookie`, not a raw ID token | ID tokens expire in 1h and can't be revoked; session cookies can, and are the documented Firebase+SSR path. |
| D7 | Next.js `16.3.0` | Pin whatever `npm` resolves at scaffold; record it in §2.1 | Do not stall the build loop on an exact patch version. |
| D8 | Responsive web app | **Mobile app only** — no breakpoints above the phone frame | User directive; Stitch frames are 780×1768. |

---

## 1. System architecture

```
                    ┌─────────────────────────────────────────┐
                    │  Phone browser / installed PWA (390×844)│
                    │  RSC payloads · Server Action POSTs     │
                    └───────────────┬─────────────────────────┘
                                    │ HTTPS
                    ┌───────────────▼─────────────────────────┐
                    │  Google Cloud Run (container)           │
                    │  Next.js App Router, output: standalone │
                    │   ├ middleware.ts   session gate        │
                    │   ├ Server Components   read via Prisma │
                    │   ├ Server Actions      write via Prisma│
                    │   └ /api/cron           bearer-secured  │
                    └───────┬─────────────────────┬───────────┘
                            │ Prisma (pooled)     │ verify session cookie
                    ┌───────▼──────────┐  ┌───────▼──────────┐
                    │ NeonDB Postgres17│  │ Firebase Auth    │
                    │ db: trucking-go  │  │ Google OAuth     │
                    └──────────────────┘  └──────────────────┘
                            ▲
                            │ every 60s: POST /api/cron
                    ┌───────┴──────────┐
                    │ Cloud Scheduler  │
                    └──────────────────┘
```

### 1.1 Read path
Navigation → middleware verifies the session cookie → Server Component queries Prisma directly (no internal
HTTP hop) → RSC payload streams to the client. Client components receive plain serializable props.

### 1.2 Write path
Form submit → Server Action → `requireSession()` → role guard → `zod.safeParse` → Prisma (transaction if
multi-row) → `revalidatePath(...)` → RSC re-render with fresh data. Actions return `ActionResult`, they do
not throw for expected failures.

### 1.3 Scheduled path
Cloud Scheduler → `POST /api/cron` with `Authorization: Bearer $CRON_SECRET` → single `updateMany` closing
expired auctions → returns `{ closed: n }`. Idempotent; safe to run concurrently with itself.

---

## 2. Stack, versions, environment

### 2.1 Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router, RSC, Server Actions) | Target `16.3.0`; **A0 records the resolved version here** |
| Language | TypeScript, `strict: true` | `noUncheckedIndexedAccess` on |
| DB | PostgreSQL 17 — Neon (`trucking-go`) in cloud, Docker locally | |
| ORM | Prisma | `prisma migrate` for schema, no `db push` in CI |
| Auth | Firebase Auth (Google) + Firebase Admin SDK | session cookies |
| Styling | Tailwind CSS + Shadcn UI primitives | retheme Shadcn to the M3 tokens |
| Icons | Material Symbols Outlined (webfont) | **not** Lucide |
| Font | Inter 400/700/800/900 | `next/font` self-host |
| Validation | zod | shared schemas in `src/lib/schemas.ts` |
| Tests | vitest | pure logic only |
| Container | Docker multi-stage, `output: 'standalone'` | |
| Host | Cloud Run + Cloud Scheduler | |

### 2.2 Environment variables

| Var | Scope | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | server | yes | Postgres connection (Neon pooled in prod) |
| `DIRECT_URL` | server | prod | Unpooled URL for `prisma migrate` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | client | yes | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | client | yes | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client | yes | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | client | yes | |
| `FIREBASE_ADMIN_PROJECT_ID` | server | yes | |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | server | yes | |
| `FIREBASE_ADMIN_PRIVATE_KEY` | server | yes | newlines escaped as `\n` |
| `CRON_SECRET` | server | yes | bearer token for `/api/cron` |
| `DEV_AUTH_BYPASS` | server | dev only | `true` mocks a session — **must fail the build in production** |
| `DEV_BYPASS_ROLE` | server | dev only | `SHIPPER` \| `CARRIER` for the mock session |

`.env.example` carries every key with empty/dummy values. `.env.local` is gitignored and never committed.

---

## 3. Data model

### 3.1 Schema

PRD models and fields verbatim; the only additions are indexes (D2).

```prisma
enum Role          { SHIPPER CARRIER }
enum AuctionStatus { ACTIVE CLOSED_EXPIRED COMPLETED_ASSIGNED }
enum BidStatus     { PENDING ACCEPTED REJECTED }

model User {
  id           String    @id @default(uuid())
  firebaseUid  String    @unique
  email        String    @unique
  name         String
  profileImage String?
  role         Role?                       // null until onboarding completes
  createdAt    DateTime  @default(now())
  auctions     Auction[] @relation("ShipperAuctions")
  bids         Bid[]     @relation("CarrierBids")
}

model Auction {
  id              String        @id @default(uuid())
  shipperId       String
  pickupLocation  String
  dropoffLocation String
  materialDetails String
  weightKg        Float
  status          AuctionStatus @default(ACTIVE)
  endTime         DateTime
  createdAt       DateTime      @default(now())
  shipper         User          @relation("ShipperAuctions", fields: [shipperId], references: [id])
  bids            Bid[]

  @@index([status, endTime])       // carrier feed + cron sweep
  @@index([shipperId, createdAt])  // shipper dashboard & history
}

model Bid {
  id        String    @id @default(uuid())
  auctionId String
  carrierId String
  amount    Float
  status    BidStatus @default(PENDING)
  createdAt DateTime  @default(now())
  auction   Auction   @relation(fields: [auctionId], references: [id])
  carrier   User      @relation("CarrierBids", fields: [carrierId], references: [id])

  @@index([auctionId, amount])       // bid list, lowest-first + "Best Price"
  @@index([carrierId, createdAt])    // My Bids
}
```

### 3.2 Auction state machine

```
                 shipper accepts a bid
        ┌──────────────────────────────────► COMPLETED_ASSIGNED   (terminal)
        │                                     winner: ACCEPTED, others: REJECTED
   ACTIVE
        │        cron: endTime <= now()
        └──────────────────────────────────► CLOSED_EXPIRED       (terminal)
                                              all bids stay PENDING
```

Legal transitions are **only** those two arrows. Both terminal states are final — no reopening, no
un-accepting. Every write that mutates an auction guards on `status = 'ACTIVE'` in its `WHERE` clause.

### 3.3 Bid rules

- A carrier **may bid multiple times** on the same auction (it's a reverse auction — you lower your price).
  There is deliberately **no** unique constraint on `(auctionId, carrierId)`.
- Each new bid from a carrier must be **strictly lower** than that carrier's own previous bid on the auction.
- Lists show **one row per carrier — their latest bid** — ordered by amount ascending.
- "Best Price" badge goes to the single global minimum. On a tie, the earliest `createdAt` wins.
- Bids are never deleted or cancelled ("Bids cannot be canceled once submitted").

### 3.4 Seed data (`prisma/seed.ts`)

Must cover every state both lanes need to see:

| Fixture | Detail |
|---|---|
| 2 shippers | `shipper1@demo.test`, `shipper2@demo.test` |
| 3 carriers | `carrier1..3@demo.test` |
| 1 role-less user | to exercise the `/onboarding` redirect |
| Auction 1 | ACTIVE, ends +2h, Mumbai→Pune, 5 T Steel Coils, **3 bids** |
| Auction 2 | ACTIVE, ends +5h45m, Delhi→Jaipur, 12 T Electronics, **0 bids** |
| Auction 3 | ACTIVE, ends **+4 min** — exercises the red expiring timer |
| Auction 4 | CLOSED_EXPIRED, ended −1h, 2 bids left PENDING |
| Auction 5 | COMPLETED_ASSIGNED, 1 ACCEPTED + 2 REJECTED bids |

---

## 4. Authentication

### 4.1 Sequence

```
Client                     Server Action              Firebase Admin        Postgres
  │ signInWithPopup(Google)
  │───────────────► Firebase Auth ──► ID token
  │ createSession(idToken)
  │──────────────────────►│
  │                       │ verifyIdToken ───────────────►│
  │                       │ createSessionCookie(5d) ──────►│
  │                       │ upsert User by firebaseUid ───────────────────►│
  │                       │ Set-Cookie __session (HttpOnly, Secure, Lax)
  │◄──────────────────────│ { ok, role }
  │ role === null → /onboarding · SHIPPER → /shipper · CARRIER → /carrier
```

### 4.2 Session helpers — `src/lib/session.ts`

```ts
type Session = { userId: string; firebaseUid: string; email: string;
                 name: string; profileImage: string | null; role: Role | null };

getSession():     Promise<Session | null>   // verifySessionCookie + DB lookup; never throws
requireSession(): Promise<Session>          // redirect('/login') when absent
requireRole(r):   Promise<Session>          // redirect('/onboarding') if role null;
                                            // redirect to the other role's home on mismatch
```

Cookie: name `__session`, `httpOnly`, `secure` in production, `sameSite: 'lax'`, `path: '/'`,
`maxAge` 5 days. Sign-out clears the cookie **and** calls `revokeRefreshTokens`.

### 4.3 Middleware — `middleware.ts`

Middleware performs a **cheap presence check only** — the Firebase Admin SDK does not run on the Edge
runtime. Full cryptographic verification happens in `getSession()` inside Server Components/Actions.

| Path | Rule |
|---|---|
| `/api/cron` | always allowed (its own bearer check) |
| `/login` | redirect to `/` if a cookie is present |
| `/onboarding` | requires a cookie |
| `/shipper/*`, `/carrier/*`, `/profile` | requires a cookie, else `/login` |
| `/_next/*`, `/icons/*`, `/manifest.json`, `/favicon.ico` | public |

Role separation (a CARRIER hitting `/shipper/*`) is enforced by `requireRole()` in the page, not middleware.

### 4.4 `DEV_AUTH_BYPASS`

When `DEV_AUTH_BYPASS=true` **and** `NODE_ENV !== 'production'`, `getSession()` returns a fixed session
built from the seeded `shipper1@demo.test` / `carrier1@demo.test` (selected by `DEV_BYPASS_ROLE`) without
touching Firebase. This is what lets both lanes build and verify every screen with no cloud credentials.

`next.config` **must throw at build time** if `DEV_AUTH_BYPASS === 'true' && NODE_ENV === 'production'`.

---

## 5. Server Action catalogue

All actions live in `src/lib/actions/*`, are marked `"use server"`, and return:

```ts
type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string; field?: string };
```

### 5.1 `setUserRole` — `actions/user.ts` *(Lane A)*

```ts
Input:  { role: 'SHIPPER' | 'CARRIER' }
Guards: requireSession(); reject if session.role !== null   // role is chosen once
Effect: user.update({ role })
After:  revalidatePath('/', 'layout'); redirect to the role's home
```

### 5.2 `createAuction` — `actions/auction.ts` *(Lane A)*

```ts
CreateAuctionSchema = z.object({
  pickupLocation:  z.string().trim().min(2).max(120),
  dropoffLocation: z.string().trim().min(2).max(120),
  materialDetails: z.string().trim().min(2).max(240),
  weightTons:      z.coerce.number().positive().max(100),
  durationHours:   z.union([z.literal(1), z.literal(6), z.literal(12), z.literal(24)]),
})

Guards: requireRole('SHIPPER')
Effect: auction.create({ shipperId: session.userId,
                         weightKg: weightTons * 1000,          // D4
                         endTime: new Date(Date.now() + durationHours * 3_600_000),
                         status: 'ACTIVE' })
After:  revalidatePath('/shipper'); revalidatePath('/carrier'); redirect(`/shipper/auction/${id}`)
```

### 5.3 `submitBid` — `actions/bid.ts` *(Lane B)*

```ts
SubmitBidSchema = z.object({ auctionId: z.string().uuid(),
                             amount: z.coerce.number().positive().max(10_000_000) })

Guards (ALL server-side — the UI equivalents are decoration):
  1. requireRole('CARRIER')
  2. auction exists
  3. auction.status === 'ACTIVE'
  4. auction.endTime > new Date()          ← the client countdown is never trusted
  5. auction.shipperId !== session.userId  ← cannot bid on your own load
  6. amount < this carrier's own previous lowest bid on this auction, if any
Effect: bid.create({ auctionId, carrierId: session.userId, amount, status: 'PENDING' })
After:  revalidatePath(`/carrier/auction/${auctionId}`)
        revalidatePath(`/shipper/auction/${auctionId}`)
        revalidatePath('/carrier/bids'); revalidatePath('/shipper')
```

Guard 4 is the reason the cron job's ≤60s lag is harmless: an auction whose `endTime` has passed but whose
row still reads `ACTIVE` still rejects bids.

### 5.4 `acceptBid` — `actions/auction.ts` *(Lane A)* — the critical transaction

The shipper accepting a bid races against the cron job expiring the same auction. Read-then-write loses that
race. The fix is a **status-guarded conditional update**: claim the auction first, and only proceed if the
claim actually changed a row.

```ts
Guards: requireRole('SHIPPER'); bid exists; bid.auction.shipperId === session.userId

await prisma.$transaction(async (tx) => {
  // 1. CLAIM — atomically flips ACTIVE → COMPLETED_ASSIGNED. Whoever wins this wins the race.
  const claimed = await tx.auction.updateMany({
    where: { id: auctionId, status: 'ACTIVE', endTime: { gt: new Date() } },
    data:  { status: 'COMPLETED_ASSIGNED' },
  });
  if (claimed.count === 0) throw new AuctionNoLongerActiveError();

  // 2. winner
  await tx.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } });

  // 3. everyone else
  await tx.bid.updateMany({
    where: { auctionId, id: { not: bidId }, status: 'PENDING' },
    data:  { status: 'REJECTED' },
  });
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
```

`AuctionNoLongerActiveError` surfaces as `{ ok: false, error: 'This auction just closed.' }` — the UI
refreshes rather than showing a crash. Revalidates `/shipper`, `/shipper/auction/[id]`, `/carrier`,
`/carrier/bids`.

### 5.5 `/api/cron/route.ts` *(Lane A)*

```ts
POST /api/cron
  Authorization: Bearer ${CRON_SECRET}     // timing-safe compare; 401 otherwise
  → updateMany({ where: { status: 'ACTIVE', endTime: { lte: new Date() } },
                 data:  { status: 'CLOSED_EXPIRED' } })
  → 200 { closed: n }
```

Bids on an expired auction remain `PENDING` — nobody won. Idempotent, concurrency-safe (the `WHERE` clause
makes a second run a no-op), and it can never clobber a `COMPLETED_ASSIGNED` auction because that row is no
longer `ACTIVE`. `export const dynamic = 'force-dynamic'`; no caching.

### 5.6 Query reference

| Screen | Query |
|---|---|
| Shipper dashboard | `auction.findMany({ where: { shipperId, status: 'ACTIVE' }, orderBy: { endTime: 'asc' }, include: { _count: { select: { bids: true } } } })` |
| Shipper history | same, `status: { in: ['CLOSED_EXPIRED','COMPLETED_ASSIGNED'] }`, `orderBy: { createdAt: 'desc' }` |
| Shipper auction detail | auction + `bids: { orderBy: { amount: 'asc' }, include: { carrier: true } }`, then reduce to latest-per-carrier |
| Carrier feed | `auction.findMany({ where: { status: 'ACTIVE', endTime: { gt: now } }, orderBy: { endTime: 'asc' }, include: { _count: { select: { bids: true } } } })` |
| Carrier auction detail | auction + `min(amount)` across its bids + this carrier's own latest bid |
| My Bids | `bid.findMany({ where: { carrierId }, orderBy: { createdAt: 'desc' }, include: { auction: true } })` |

---

## 6. Design system reference *(Lane B owns §6–§8)*

Extracted from the generated HTML of Stitch project `5704144700317982042`. Full token tables live in
[`CLAUDE.md` §4](./CLAUDE.md#4-design-system) — that is the single copy; do not duplicate the hex values
here or they will drift. This section covers what CLAUDE.md doesn't: how the tokens become code.

### 6.1 Token plumbing

Tokens are declared **once** in `tailwind.config.ts` under `theme.extend` (`colors`, `borderRadius`,
`spacing`, `fontFamily`, `fontSize`) using the exact key names from the Stitch config, and mirrored as CSS
custom properties in `globals.css` for the few places Tailwind can't reach (`::selection`,
`theme-color` meta, scrollbar). `src/lib/design/tokens.ts` re-exports the same values as typed constants
for any TS that needs them (chart-free, but the timer's threshold colors use it).

Shadcn primitives are generated then **retheme**d: their default `--primary`/`--destructive` CSS variables
are repointed at `primary-container` / `error`. Do not keep Shadcn's stock slate palette anywhere.

`darkMode: 'class'`. Dark values exist in the Stitch markup (`dark:bg-surface-dim`,
`dark:text-primary-container`, `dark:text-secondary-fixed-dim`, `dark:bg-surface-container-highest`) — carry
them through, but light mode is the shipping default and the only one that must be pixel-verified.

### 6.2 Component inventory

| Component | Owner step | Props (essential) | Notes |
|---|---|---|---|
| `Button` | B1 | `variant: 'primary'\|'secondary'\|'ghost'`, `size`, `fullWidth`, `loading` | `primary` = `bg-primary-container text-on-primary-container`; sticky-footer variant is full-width, `h-14`, `rounded-lg` |
| `Input` | B1 | standard + `label`, `error`, `suffix` | `h-touch-target-min`, 16px text (prevents iOS zoom) |
| `Card` | B1 | `as`, `pressable` | the §4.4 recipe |
| `Chip` | B1 | `selected`, `onSelect` | filter chips; selected = `bg-primary-container text-on-primary-container` |
| `Badge` | B1 | `tone: 'brand'\|'neutral'\|'error'\|'success'` | bid counts, statuses |
| `Avatar` | B1 | `src`, `name`, `size` | initials fallback |
| `Sheet` | B1 | bottom sheet | confirmations; never a centered desktop modal |
| `Skeleton` | B1 | `lines`, `variant: 'card'\|'text'` | every `loading.tsx` |
| `EmptyState` | B1 | `icon`, `title`, `body`, `cta` | required on every list |
| `MobileNav` | B2 | `role`, `active` | SHIPPER: Home/History/Profile · CARRIER: Find Loads/My Bids/Profile |
| `Timer` | B2 | `endTime: string (ISO)`, `size` | see §7.3 |
| `AuctionCard` | B2 | `auction`, `variant: 'shipper'\|'carrier'` | LIVE badge + timer + route row + metadata strip |
| `RouteRow` | B2 | `from`, `to` | §4.4 recipe |
| `BidCard` | B2 | `bid`, `isBest`, `onAccept?` | ₹ in `display-price`, green when ACCEPTED |
| `Fab` | B2 | `icon`, `href` | shipper dashboard only |
| `PollingRefresher` | B2 | `intervalMs` | §7.4 |

### 6.3 Screen → route → component map

| Stitch screen | Screen ID | Route | Step |
|---|---|---|---|
| Splash & Login | `23b5db873d684cb1af8e716879c4ab9f` | `/login` | A1 |
| Role Selection | `a3fd9497fe1c40d08b56ba95c58202d7` | `/onboarding` | A2 |
| Shipper Dashboard | `2a58c34ed93845e29def176c80cc2648` | `/shipper` | A3 |
| Create Auction Form | `5351d3902a5149ed91c6e59678e51bd1` | `/shipper/create` | A4 |
| Shipper Auction Details | `d8dfb998516d446181dd7245c2c45e7a` | `/shipper/auction/[id]` | A5 |
| Carrier Load Feed | `36d28947d9c84715a0d418d3c0a5e2e9` | `/carrier` | B3 |
| Place a Bid | `69e048b55c6a46a78c57fff5d52fdf6e` | `/carrier/auction/[id]` | B4 |
| Bid Confirmation Success | `16fc1711669148ceac2c4d7f91f79014` | `/carrier/auction/[id]` success sheet | B4 |
| TruckingGO Logo | `70b66552da1549d8a24ee67735b7e067` | brand asset → `public/icons` | B0 |
| Animated SVG | `8067565707f14109bb5219535c1dd89c` | optional splash animation | B0 |
| *(none — hand-built)* | — | `/carrier/bids` | B5 |
| *(none — hand-built)* | — | `/profile` | B6 |
| *(none — hand-built)* | — | `/shipper/history` | A7 |

---

## 7. Mobile application spec

### 7.1 Shell geometry

```
┌─────────────────────────── safe-area-top ──┐
│ TopAppBar   fixed  h-48  z-50               │  avatar + wordmark + bell
├─────────────────────────────────────────────┤
│ main   pt-[48+24]  pb-[64+24]  px-16        │  ← the only scrolling region
│        space-y-16                           │
│                                    ┌──────┐ │
│                                    │ FAB  │ │  fixed bottom-[64+16] right-16, 56×56
│                                    └──────┘ │
├─────────────────────────────────────────────┤
│ BottomNav   fixed  h-64  z-50  pb-safe      │  3 items, FILL 0/1 icon + label-bold
└──────────────────────── safe-area-bottom ───┘
```

`<html>`/`<body>`: `overscroll-behavior: none`, `overflow-x: hidden`, `-webkit-tap-highlight-color:
transparent`, `touch-action: manipulation`. Baseline device: **390×844**.

### 7.2 PWA

`public/manifest.json`: `name` "TruckingGO", `short_name` "TruckingGO", `display: "standalone"`,
`orientation: "portrait-primary"`, `background_color: "#f7f9fb"`, `theme_color: "#a04100"`, `start_url: "/"`,
icons 192/512 + maskable, derived from the Stitch logo screen. Apple meta:
`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: default`, apple-touch-icon.
Viewport: `width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1`.

No service worker in v1 — an offline cache over a live auction feed shows stale prices, which is worse than
an error. Offline is handled as a visible banner (§7.5).

### 7.3 Countdown timer

The single most correctness-sensitive component.

- Prop is an **absolute ISO `endTime`**, never a duration. RSC payloads are cached; a duration computed on
  the server is already wrong when it renders. (D3/§0)
- Ticks every 1000ms off `Date.now()`; recomputes from the absolute target each tick so tab-throttling and
  device sleep self-correct instead of accumulating drift.
- Format: `02h 14m` above 1h, `45m 12s` under 1h, `00m 09s` under a minute.
- Color: `text-primary` normally → **`text-error`** at ≤ 30 min remaining.
- On reaching zero it renders "Expired" locally and calls `router.refresh()` once — the row may still read
  `ACTIVE` for up to 60s until cron sweeps it, and §5.3 guard 4 makes that harmless.
- Guard against hydration mismatch: render the server-computed value on first paint, start ticking in
  `useEffect`.

### 7.4 Live-bid polling

`PollingRefresher` is a client component mounted on `/shipper/auction/[id]`, `/carrier`, and
`/carrier/auction/[id]`. Every **7s**, if `document.visibilityState === 'visible'`, it calls
`router.refresh()`. It pauses on hidden tabs and resumes with an immediate refresh on `visibilitychange`.
Chosen over websockets deliberately (D3): Cloud Run scales to zero and Neon offers no realtime channel.

### 7.5 State coverage

Every list screen ships all four:

| State | Treatment |
|---|---|
| Loading | `loading.tsx` with `Skeleton` cards matching the real card's geometry |
| Empty | `EmptyState` — shipper: "No active auctions" + "Post a Load"; carrier: "No loads available right now" |
| Error | `error.tsx` — plain message + "Try again" (`reset()`); never a raw stack |
| Offline | `navigator.onLine === false` → sticky `error-container` banner above `main` |

### 7.6 Interaction rules

Tap targets ≥ 48px with ≥ 8px between them. Press feedback on everything tappable. Destructive/irreversible
actions (submit bid, accept bid) confirm in a **bottom `Sheet`**, never a centered modal, and the confirm
button sits in the sticky footer within thumb reach. Number inputs use `inputMode="decimal"` with a ₹
prefix. Forms show inline field errors from the action's `field` key. No toasts for success on a screen that
navigates — navigate and show the success screen instead (Stitch *Bid Confirmation Success*).

Pattern references consulted: [Deliveroo](https://mobbin.com/screens/ec7011ae-d011-456c-9975-c4071a90a08e)
(chip row over a feed) · [Too Good To Go](https://mobbin.com/screens/8de18ab2-04b7-4127-87e6-4781495654f5)
(segmented browse for My Bids) · [Instacart](https://mobbin.com/screens/c1737479-f19d-4533-afbe-6801a20edf77)
(approve/reject with a visible response window) ·
[Vestiaire Collective](https://mobbin.com/screens/61cab6cc-d6dd-4010-b2ff-7d21f5531ca7) (pending offer with
a deadline).

### 7.7 Accessibility

Text contrast ≥ 4.5:1 (the M3 token pairs are designed for this — keep the `on-*` pairings intact and it
holds). Never signal state by color alone: the LIVE badge pairs red with the word "Live"; ACCEPTED pairs
green with "Won". Every icon-only button gets an `aria-label`. Timers are `aria-live="off"` (a per-second
announcement is hostile) with an `aria-label` carrying the full remaining time. Respect
`prefers-reduced-motion` — that includes the LIVE badge's `animate-ping`.

---

## 8. Testing & verification

### 8.1 Unit (vitest) — pure logic only, no DB, no rendering

- Timer formatting across boundaries: 24h, 1h, 60s, 0, negative (already expired).
- `weightTons ↔ weightKg` round-trip.
- INR formatting (no decimals, `en-IN` grouping: `₹4,50,000`).
- Every zod schema: boundary and rejection cases.
- Latest-bid-per-carrier reduction and "Best Price" selection, including the tie → earliest rule.

### 8.2 Manual mobile checklist (run per screen before marking a step done)

1. DevTools device toolbar at **390×844**.
2. No horizontal scrollbar anywhere.
3. Top bar and bottom nav stay fixed while `main` scrolls; content is never hidden behind either.
4. Every tap target ≥ 48px.
5. Empty and error states reachable (delete the seed rows / kill the DB).
6. Timer counts down and turns red under 30 min (seeded Auction 3 ends in 4 min).
7. No `md:`/`lg:` classes: `grep -rn "\b\(sm\|md\|lg\|xl\):" src/` returns nothing.

### 8.3 End-to-end scenario (manual, after A6 + B4)

Sign in as `shipper1` → post a load with a 1h duration → sign in as `carrier1` → the load appears in the
feed → bid ₹45,000 → as `carrier2` bid ₹42,000 → back as `shipper1`, both bids appear within 7s and
carrier2 carries the "Best Price" badge → accept carrier2 → auction reads COMPLETED_ASSIGNED, carrier2's bid
ACCEPTED, carrier1's REJECTED → the load is gone from the carrier feed → `/carrier/bids` shows Won for
carrier2 and Lost for carrier1.

Cron check: seed an auction with `endTime` in the past, `curl -X POST localhost:3000/api/cron -H
"Authorization: Bearer $CRON_SECRET"` → `{ closed: 1 }`; a second call → `{ closed: 0 }`.

---

## 9. Deployment (GCP)

Both `Dockerfile` and `cloudbuild.yaml` are created in **`A0`, at the very start of the project**, so the
app is deployable from the first commit rather than at the end. All secrets live in **Google Secret
Manager** — nothing sensitive is committed, baked into an image, or passed as a Cloud Build substitution.

### 9.1 Container — `Dockerfile`

Multi-stage: `deps` (`npm ci`) → `builder` (`prisma generate` + `next build`, `output: 'standalone'`) →
`runner` (`node:22-alpine`, non-root `nextjs` user, copies `.next/standalone` + `.next/static` + `public` +
`prisma/`). `ENV PORT=8080 NODE_ENV=production`, `EXPOSE 8080`, `CMD ["node","server.js"]`.

**The one subtlety:** `NEXT_PUBLIC_*` values are inlined into the client bundle at **build** time, so the
four Firebase client keys must be present during `next build`. They arrive as `--build-arg` sourced from
Secret Manager (§9.2), *not* from the runtime environment. Server-only secrets (`DATABASE_URL`,
`FIREBASE_ADMIN_*`, `CRON_SECRET`) must **never** be build args — they would be baked into image layers.

```dockerfile
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
# ... etc, in the builder stage only
```

Prisma needs a syntactically valid `DATABASE_URL` at build time for `prisma generate`; use the literal
placeholder `postgresql://build:build@localhost:5432/build` — it is never connected to.

### 9.2 CI/CD — `cloudbuild.yaml`

```yaml
substitutions:
  _REGION: asia-south1
  _SERVICE: truckinggo
  _REPO: truckinggo               # Artifact Registry repo
  _AR: ${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/${_SERVICE}

# Build-time secrets: ONLY the NEXT_PUBLIC_* client keys (they must be inlined into the bundle).
availableSecrets:
  secretManager:
    - versionName: projects/${PROJECT_ID}/secrets/FIREBASE_API_KEY/versions/latest
      env: NEXT_PUBLIC_FIREBASE_API_KEY
    - versionName: projects/${PROJECT_ID}/secrets/FIREBASE_AUTH_DOMAIN/versions/latest
      env: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    - versionName: projects/${PROJECT_ID}/secrets/FIREBASE_PROJECT_ID/versions/latest
      env: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    - versionName: projects/${PROJECT_ID}/secrets/FIREBASE_APP_ID/versions/latest
      env: NEXT_PUBLIC_FIREBASE_APP_ID
    - versionName: projects/${PROJECT_ID}/secrets/DIRECT_URL/versions/latest
      env: DIRECT_URL

steps:
  # 1. Build the image, passing only the client keys as build args.
  - id: build
    name: gcr.io/cloud-builders/docker
    entrypoint: bash
    secretEnv: [NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID]
    args:
      - -c
      - |
        docker build \
          --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="$$NEXT_PUBLIC_FIREBASE_API_KEY" \
          --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
          --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="$$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
          --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="$$NEXT_PUBLIC_FIREBASE_APP_ID" \
          -t ${_AR}:$SHORT_SHA -t ${_AR}:latest .

  # 2. Push both tags.
  - id: push
    name: gcr.io/cloud-builders/docker
    args: [push, --all-tags, '${_AR}']

  # 3. Migrate BEFORE traffic shifts. Uses the DIRECT (unpooled) Neon URL.
  - id: migrate
    name: '${_AR}:$SHORT_SHA'
    entrypoint: npx
    secretEnv: [DIRECT_URL]
    env: ['DATABASE_URL=$$DIRECT_URL']
    args: [prisma, migrate, deploy]

  # 4. Deploy. Runtime secrets are MOUNTED from Secret Manager, never passed through the build.
  - id: deploy
    name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args:
      - run, deploy, '${_SERVICE}'
      - --image=${_AR}:$SHORT_SHA
      - --region=${_REGION}
      - --platform=managed
      - --allow-unauthenticated
      - --port=8080
      - --min-instances=0
      - --max-instances=10
      - --concurrency=80
      - --memory=512Mi
      - --cpu=1
      - --set-env-vars=NODE_ENV=production
      - --set-secrets=DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,FIREBASE_ADMIN_PROJECT_ID=FIREBASE_ADMIN_PROJECT_ID:latest,FIREBASE_ADMIN_CLIENT_EMAIL=FIREBASE_ADMIN_CLIENT_EMAIL:latest,FIREBASE_ADMIN_PRIVATE_KEY=FIREBASE_ADMIN_PRIVATE_KEY:latest,CRON_SECRET=CRON_SECRET:latest

images: ['${_AR}:$SHORT_SHA', '${_AR}:latest']
options:
  logging: CLOUD_LOGGING_ONLY
  machineType: E2_HIGHCPU_8
timeout: 1200s
```

Note the `$$` escaping inside `secretEnv` shell steps — a single `$` would be consumed as a Cloud Build
substitution. `DEV_AUTH_BYPASS` is deliberately absent from every deploy path; if it ever leaked in,
`next.config.ts` fails the build (§4.4).

### 9.3 Secret Manager inventory

Every secret is created once (see `docs/gcp-setup.md`, written in A0) and referenced by name thereafter.

| Secret name | Consumed at | How | Contents |
|---|---|---|---|
| `DATABASE_URL` | runtime | `--set-secrets` | Neon **pooled** connection string |
| `DIRECT_URL` | build (migrate step) + runtime | `availableSecrets` + `--set-secrets` | Neon **direct/unpooled** string |
| `FIREBASE_API_KEY` | build | `availableSecrets` → build-arg | → `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `FIREBASE_AUTH_DOMAIN` | build | `availableSecrets` → build-arg | → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `FIREBASE_PROJECT_ID` | build | `availableSecrets` → build-arg | → `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `FIREBASE_APP_ID` | build | `availableSecrets` → build-arg | → `NEXT_PUBLIC_FIREBASE_APP_ID` |
| `FIREBASE_ADMIN_PROJECT_ID` | runtime | `--set-secrets` | service-account project id |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | runtime | `--set-secrets` | service-account email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | runtime | `--set-secrets` | PEM, real newlines — see below |
| `CRON_SECRET` | runtime | `--set-secrets` | random 32-byte hex bearer token |

The four `FIREBASE_*` client keys are not confidential (they ship in the browser bundle) but are stored in
Secret Manager anyway so that one mechanism supplies every value and nothing lands in git.

**`FIREBASE_ADMIN_PRIVATE_KEY`**: store the PEM with **real newlines** in Secret Manager
(`gcloud secrets create ... --data-file=key.pem`), and have `adminApp.ts` tolerate both forms —
`key.replace(/\\n/g, '\n')` — so the same code works with a `.env.local` that uses escaped `\n`.

**One-time bootstrap** (`docs/gcp-setup.md`):

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com

gcloud artifacts repositories create truckinggo \
  --repository-format=docker --location=asia-south1

printf '%s' "$VALUE" | gcloud secrets create DATABASE_URL --data-file=-   # repeat per secret

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
# Cloud Build reads build-time secrets:
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
# Cloud Run's runtime SA reads mounted secrets:
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
# Cloud Build deploys to Cloud Run:
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role=roles/run.admin
gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role=roles/iam.serviceAccountUser
```

Deploy: `gcloud builds submit --config cloudbuild.yaml .` (or attach a Cloud Build trigger on push to
`main` once both lanes have finished — leave it manual during the build loop, so the two lanes' rapid
pushes don't each fire a deploy).

### 9.4 Cloud Run

Region `asia-south1` (co-locate with Neon). Min instances 0, max 10, concurrency 80, 512Mi / 1 vCPU,
port 8080. Unauthenticated invocations allowed — the app does its own auth. Secrets are **mounted as env
vars from Secret Manager**, so rotating a secret is a new secret version plus a redeploy, with no image
rebuild.

### 9.5 Database

Neon project database `trucking-go`, two schemas per the PRD: `public` (application tables) and `shadow`
(Prisma's shadow DB for migrations). Runtime uses the **pooled** `DATABASE_URL`; migrations use the
**direct** `DIRECT_URL` — a pooled connection cannot run DDL reliably. Migrations run in the `migrate`
build step (§9.2 step 3) *before* the new revision takes traffic. `prisma migrate deploy` only —
never `db push` against a deployed database.

### 9.6 Cloud Scheduler

Job `close-expired-auctions`, schedule `* * * * *`, HTTP POST to `https://<service-url>/api/cron`, header
`Authorization: Bearer ${CRON_SECRET}` (read from Secret Manager when creating the job — do not paste it
into a shell history), timeout 30s, retry 3. Full runbook in `docs/cloud-scheduler.md` (A6).

### 9.7 Release checklist

`DEV_AUTH_BYPASS` absent from Cloud Run · all 10 Secret Manager secrets exist with a `latest` version ·
both service accounts hold `secretAccessor` · Firebase authorized domains include the Cloud Run URL ·
`CRON_SECRET` is not the dev value · `prisma migrate deploy` succeeded in the build log · `/api/cron`
returns 401 without a bearer · `docker history` shows no server secret in any layer · no `NEXT_PUBLIC_`
variable carries a server secret · PWA installs and launches standalone on a real phone.
