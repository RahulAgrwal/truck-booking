# Feature board — contact exchange + mutual ratings

> **Both Claudes read this file before touching the feature.** It is the coordination surface: the step
> tables below are the only place status lives. Full design rationale is in the approved plan; the parts
> you need to build correctly are restated here so you never have to go looking for it.

---

## 0. This feature re-draws the lane boundary

`CLAUDE.md` §3 / `BuildPlan.md` §3 split the build **vertically** — foundation+Shipper vs
design-system+Carrier. That split has done its job: both lanes are code-complete. For this feature the
split is **horizontal**, by user direction:

| | **Lane A — Claude 1 — Frontend** | **Lane B — Claude 2 — Backend + migration** |
|---|---|---|
| Owns | `src/app/**` · `src/components/**` | `prisma/**` · `src/lib/**` (incl. `actions/`, `session.ts`, `schemas.ts`) |
| Builds | Screens, forms, the contact card, the star input, the rate sheet, every loading / empty / error state | Schema, migration, seed, zod contracts, the visibility rule, the Server Actions, and every unit test for those |
| Ledger | `docs/progress-A.md` | `docs/progress-B.md` |

**One rule replaces all the old ownership paperwork:**

> If a file is under `src/app/` or `src/components/`, it is **Lane A's**.
> If it is under `prisma/` or `src/lib/`, it is **Lane B's**.

No carve-outs, no exceptions. The Maps carve-outs (`LocationAutocomplete.tsx`, `route-map*.tsx`) are not
touched by this feature and keep their existing owner.

### Two rules that override everything else

- **Never `git add -A`.** Both lanes work in `D:\Truck-booking`, one tree. `-A` stages the other lane's
  half-finished work into your commit. Always `git add <explicit paths>`.
- **`npm run db:seed` truncates the shared Neon database.** Lane B owns seeding, runs it once,
  deliberately, and says so in `docs/progress-B.md` first.

### ⚠ Off limits right now — Claude 2 has three frontend files open

Uncommitted in this checkout at the time of writing: a "Bid placed / New" per-viewer badge across

```
src/components/auction-card.tsx
src/app/(dashboard)/carrier/page.tsx
src/app/(dashboard)/carrier/loading.tsx
```

Under the new split these are Lane A files, but **Lane A must not touch them until Claude 2 commits**.
Editing a file another agent has open destroys their work. They transfer to Lane A on that commit.
Consequence: the shipper-rating-on-the-feed-card idea is deferred (§5).

---

## 1. Status protocol

Markers, exactly as `BuildPlan.md` §10.0:

| Marker | Means |
|---|---|
| `[ ]` | Not started |
| `[~]` | **In progress right now** — claimed *before* the first line of code, committed and pushed on its own |
| `[x]` | Done, committed, pushed |
| `[!]` | Blocked — write which gate in the Notes column |

The order is: mark `[~]` → **commit and push that one line** → then build → flip `[~]` → `[x]` in the same
commit as the work. It costs one small commit, and it is what makes two agents legible to each other: a
`[~]` that survives several of the other lane's pulls means something is stuck.

**Each lane edits only its own table.** The file is split into two tables precisely so a concurrent edit
cannot conflict. A gate is *"does this file / export exist after `git pull`"* — nothing else, no
time-based coordination.

---

## 2. The two rules the feature is built on

**Rule 1 — contact visibility.**

> User X's contact details are visible to user Y **iff** there exists an auction A where
> `A.status = COMPLETED_ASSIGNED`, A has a bid B with `B.status = ACCEPTED`, and
> `{A.shipperId, B.carrierId} = {X, Y}`.

Corollaries that must hold: an expired auction reveals nothing (nobody won); a losing carrier gets
nothing; a third party gets nothing; and the rule is symmetric — neither side sees the other without
being seen.

Rule 1 lives in **one server-only module, `src/lib/contact.ts`**. The sensitive columns — `phone`,
`address`, `companyName`, `truckNumber`, `truckType` — are selected **nowhere else in the codebase**.
That is the enforcement: a page cannot leak a phone number it never queried.

**Rule 2 — ratings are not contact details.** A star average and a review comment are public reputation.
They are visible *before* acceptance, to anyone looking at a bid — that is the entire point of the
feature. Nothing in the rating path is gated on Rule 1, and nothing in the contact path is ever exposed
by it. **Conflating the two is the one way this feature leaks.**

---

## 3. Step board

### Lane B — backend + migration  *(Claude 2)*

| Step | Status | Title | Gate | Files | Notes |
|---|---|---|---|---|---|
| `B1` | `[ ]` | Schema + migration | — | `prisma/schema.prisma`, `prisma/migrations/**` | |
| `B2` | `[ ]` | **Contracts** — zod, formatters, rating helpers, **typed stubs** for `contact.ts` + both actions | `B1` | `src/lib/{schemas,format,reviews,contact}.ts`, `src/lib/actions/review.ts` | **unblocks 4 Lane A steps — push the moment it compiles** |
| `B3` | `[ ]` | Visibility rule — real `dealWhere` / `canExchangeContact` / `getDeal` + tests | `B2` | `src/lib/contact.ts`, `src/lib/contact.test.ts` | opens `A4` |
| `B4` | `[ ]` | Actions — `updateContactDetails`, `submitReview` bodies | `B3` | `src/lib/actions/{user,review}.ts` | |
| `B5` | `[ ]` | Session gate — `detailsComplete`, `homePathFor`, `requireRole` redirect | `B1` | `src/lib/session.ts` | see the loop hazard in §4 |
| `B6` | `[ ]` | Read model — `raterSelect`, `reviewsFor` + tests | `B1` | `src/lib/reviews.ts`, `src/lib/reviews.test.ts` | opens `A3` |
| `B7` | `[ ]` | Seed fixtures + run `db:seed` (announce first) | `B1` | `prisma/seed.ts` | opens `A6` |

**`B2` is the unblocking commit.** It ships *signatures*, not behaviour — `getDeal` returns `null`,
`submitReview` returns `{ ok: false, error: "Not available yet." }`. This is the same device `A0` used to
hand Lane B a `globals.css` stub in the original build: it lets four Lane A steps start immediately
instead of idling behind a backend that is only half written. Push it before `B3`.

### Lane A — frontend  *(Claude 1)*

| Step | Status | Title | Gate | Files | Notes |
|---|---|---|---|---|---|
| `A0` | `[x]` | This board | — | `docs/feature-contact-ratings.md` | |
| `A1` | `[~]` | `RatingStars` + `CarrierReputation` primitives | — *(prop-driven, see §4)* | `src/components/{rating-stars,carrier-reputation}.tsx` | claimed, building now |
| `A2` | `[ ]` | Details form + onboarding step 2 + `/profile/details` | `B2` | `(auth)/onboarding/details/**`, `role-cards.tsx`, `(dashboard)/profile/details/**` | |
| `A3` | `[ ]` | **Ratings at the decision moment** — bid rows + accept sheet | `A1`, `B6` | `bid-card.tsx`, `shipper/auction/[id]/{page,accept-bid-sheet}.tsx` | |
| `A4` | `[ ]` | Contact card + rate sheet on both auction detail screens | `A1`, `B3` | `src/components/{contact-card,review-sheet}.tsx`, both `auction/[id]/page.tsx` | also fixes the `sheet.tsx` scroll-lock bug (§5) |
| `A5` | `[ ]` | Entry points — history, My Bids "Won", profile rating block | `A4` | `shipper/history`, `carrier/bids`, `profile/page.tsx` | |
| `A6` | `[ ]` | State coverage + 390×844 sweep + a11y | `A5`, `B7` | every touched route's `loading` / `error` | |

**Deadlock check.** `B1`→`B2` need nothing from A; `A0` and `A1` need nothing from B. By the time Lane A
finishes `A2`, `B3` and `B6` have landed. Neither chain can stall on the other.

---

## 4. Contracts — what each lane may assume about the other

Lane A codes against these signatures the moment `B2` lands. Lane B must not change them without saying
so here.

### Schema (`B1`)

```prisma
model User {
  phone              String?    // 10 digits, normalised, no +91 prefix stored
  address            String?
  companyName        String?    // SHIPPER
  truckNumber        String?    // CARRIER — stored normalised "MH12AB1234"
  truckType          String?    // CARRIER
  detailsCompletedAt DateTime?  // null = onboarding step 2 not done

  ratingSum   Int @default(0)   // exact aggregate; avg = sum / count
  ratingCount Int @default(0)

  reviewsWritten  Review[] @relation("ReviewsWritten")
  reviewsReceived Review[] @relation("ReviewsReceived")
}

model Review {
  id        String   @id @default(uuid())
  auctionId String
  authorId  String
  subjectId String
  stars     Int      // 1–5
  comment   String?
  createdAt DateTime @default(now())

  auction Auction @relation(fields: [auctionId], references: [id])
  author  User    @relation("ReviewsWritten",  fields: [authorId],  references: [id])
  subject User    @relation("ReviewsReceived", fields: [subjectId], references: [id])

  @@unique([auctionId, authorId])   // one review per party per job — the double-submit guard
  @@index([subjectId, createdAt])
}
```

`Auction` gains `reviews Review[]`. Everything is additive and nullable; no existing column changes
meaning.

*Why `ratingSum`/`ratingCount` rather than a cached `Float avg`:* integer arithmetic cannot drift, and
both are incremented inside the same transaction that inserts the review, so the aggregate and the rows
can never disagree. A separately recomputed average is a second source of truth for one fact.

*Why `@@unique([auctionId, authorId])` rather than a read-then-write:* same reasoning as `acceptBid`'s
status-guarded `updateMany` (TechnicalDocument §5.4) — the constraint is atomic, a read is not. Two taps
on Submit race; the loser gets Prisma `P2002` and a friendly *"You've already rated this job."*

### `src/lib/contact.ts` (`B2` stub → `B3` real)

Mirrors the shape `src/lib/auction-close.ts` already uses: the real predicate lives in a Prisma `WHERE`
that no unit test can execute, so the module exports **both** forms from one statement of the rule and the
test asserts they agree case for case.

```ts
export function dealWhere(auctionId: string, viewerId: string): Prisma.AuctionWhereInput;
export function canExchangeContact(f: {
  auctionStatus: AuctionStatus;
  shipperId: string;
  acceptedCarrierId: string | null;
  viewerId: string;
}): boolean;

export type DealParty = {
  userId: string; name: string; profileImage: string | null; role: Role;
  phone: string | null; address: string | null;
  companyName: string | null; truckNumber: string | null; truckType: string | null;
  ratingSum: number; ratingCount: number;
};
export type Deal = {
  auctionId: string; amount: number;
  me: DealParty; them: DealParty;
  iReviewed: boolean;      // has the viewer already rated? drives the rate-sheet collapse
};

export async function getDeal(auctionId: string, viewerId: string): Promise<Deal | null>;
```

`null` means "no contact card" — Lane A renders nothing, never a placeholder.

### `src/lib/reviews.ts` (`B2` stub → `B6` real)

Pure helpers plus the read shapes Lane A composes with, so **no Prisma select for ratings is ever written
inside `src/app/`**.

```ts
export function ratingAverage(sum: number, count: number): number | null;  // null at zero reviews
export function formatRating(sum: number, count: number): string;          // "4.8 (12)" | "No ratings yet"
export function starBreakdown(average: number | null): ("full" | "half" | "empty")[];  // length 5

export const raterSelect;   // { id, name, profileImage, ratingSum, ratingCount }

export type ReviewRow = {
  id: string; stars: number; comment: string | null;
  createdAt: Date; authorName: string; authorImage: string | null;
};
export function reviewsFor(userId: string, take?: number): Promise<ReviewRow[]>;  // newest first
```

`ratingAverage` returns `null` at zero reviews and never a fabricated `0.0` — "No ratings yet" is a
first-class state, not a blank.

### `src/lib/schemas.ts` (`B2`)

```ts
export const PHONE_RE = /^[6-9]\d{9}$/;                              // Indian mobile, 10 bare digits
export const TRUCK_NUMBER_RE = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}$/;

export const ContactDetailsSchema = z.discriminatedUnion("role", [
  ShipperDetailsSchema,   // { role: "SHIPPER", phone, address, companyName }
  CarrierDetailsSchema,   // { role: "CARRIER", phone, address, truckNumber, truckType }
]);
export const SubmitReviewSchema = z.object({
  auctionId: z.string().uuid(),
  stars: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(400).optional(),
});
```

Discriminated, not optional-everything, so a carrier cannot submit a shipper payload and the server never
has to guess which branch it is in.

### `src/lib/format.ts` (`B2`)

`normalizePhone` · `formatPhone` → `+91 98765 43210` · `telHref` · `normalizeTruckNumber` ·
`formatTruckNumber` → `MH 12 AB 1234`.

### Actions (`B2` stub → `B4` real)

```ts
// src/lib/actions/user.ts
updateContactDetails(input: unknown): Promise<ActionResult<{ next: string }>>
// src/lib/actions/review.ts
submitReview(input: unknown): Promise<ActionResult>
```

Standard `ActionResult`; never throws for an expected failure (CLAUDE.md §6). `submitReview`'s
authorization *is* `getDeal(...) === null ⇒ refuse` — you can only review someone you demonstrably
transacted with.

### Session & routing (`B5`)

- `Session` gains `detailsComplete: boolean` (derived from `detailsCompletedAt !== null`).
- `homePathFor(role, detailsComplete = true)` returns `/onboarding/details` for a user who has a role but
  no details. `createSession` must pass the new second argument, or a returning user lands on a dashboard
  the guard immediately bounces them off.
- `requireRole()` redirects to `/onboarding/details` when details are missing. This is what makes
  "required at onboarding" actually required rather than a suggestion on one screen.

> **⚠ Loop hazard — the one seam both lanes must read.** `/onboarding/details` (Lane A) must call
> `requireSession()`, **never** `requireRole()`, or `B5`'s guard redirects the page to itself forever.

### Note on `A1`'s gate

`RatingStars` and `CarrierReputation` are written **prop-driven** — they take
`{ average: number | null; count: number }` and never import from `src/lib/reviews.ts`. A presentational
component should not depend on a server read model, and the side effect is that `A1`'s gate is satisfied
before `B2` lands. Lane A takes it early; `BuildPlan.md` §1 explicitly allows a later step whose gate is
open.

---

## 5. Known bug to fix inside `A4`

`docs/progress-A.md` records it and nobody has fixed it: `src/components/ui/sheet.tsx` locks scroll with
`document.body.style.overflow = "hidden"`, which locks nothing — `<body>` is not the element whose
overflow propagates to the viewport, so the page still scrolls behind an open sheet. It needs
`document.documentElement`. `A4` adds two more sheets, so fix it there rather than shipping two more on
top of it.

---

## 6. Checks neither lane may skip

Run before every commit, both lanes — these cost nothing and catch what a build never would:

```bash
# Rule 1: sensitive columns live only in src/lib/contact.ts
grep -rn "truckNumber\|companyName\|\bphone\b" src/app src/components   # only own-profile + ContactCard
grep -rln "select:" src/app | xargs grep -ln "phone"                     # expect: nothing
```

Plus the existing CLAUDE.md §10.1 list (no `GOOGLE_MAPS_SERVER_API_KEY` in client-reachable code, no
`NEXT_PUBLIC_` on a server secret, no secret value committed).

---

## 7. Deferred, and why

- **Shipper rating on the carrier feed card** — `src/components/auction-card.tsx` is Claude 2's open file
  (§0). Add `shipperRating` to the carrier variant once their badge lands.
- **Editing a review** — decided against. "Not editable" keeps the aggregate a one-way increment and
  keeps `ratingSum` provably equal to the sum of the rows.
- **In-app chat / number masking** — a mature marketplace proxies the call rather than handing over a raw
  number. Out of scope; the `tel:` link is v1.
- **Phone verification (OTP)** — noted, not built. `phone` is self-asserted.
