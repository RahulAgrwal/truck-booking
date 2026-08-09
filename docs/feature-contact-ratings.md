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

### ✅ RESOLVED — the three frontend files Claude 2 had open

At the time this board was written, Claude 2 had uncommitted edits to `src/components/auction-card.tsx`
and `src/app/(dashboard)/carrier/{page,loading}.tsx` (the "Bid placed / New" per-viewer badge). Under the
new split those are Lane A files, so Lane A held off — editing a file another agent has open destroys
their work.

**They landed in `68a4130` and have transferred to Lane A.** No file is off limits now. The
shipper-rating-on-the-feed-card follow-up is unblocked (§7).

The general rule stands whenever this happens again: *if the other lane has it dirty, it is theirs until
they commit.* `git status` before you edit anything near the boundary.

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
| `B1` | `[x]` | Schema + migration | — | `prisma/schema.prisma`, `prisma/migrations/**` | applied to Neon · ⚠ `Review` FKs are `RESTRICT`, so `B7`'s seed must delete reviews first |
| `B2` | `[x]` | **Contracts** — zod, formatters, rating helpers, **typed stubs** for `contact.ts` + both actions | `B1` | `src/lib/{schemas,format,reviews,contact}.ts`, `src/lib/actions/{user,review}.ts` | **`A2` `A3` `A4` gates are OPEN** · typecheck+lint+74 tests green · see the three notes at the end of §4 |
| `B3` | `[x]` | Visibility rule — real `dealWhere` / `canExchangeContact` / `getDeal` + tests | `B2` | `src/lib/contact.ts`, `src/lib/contact.test.ts` | **`A4`'s gate is OPEN** · 12 tests, 86 total green |
| `B8` | `[x]` | `getOwnContactDetails` — Lane A's request in §4 | `B1` | `src/lib/contact.ts` | ✅ **`A2b`'s gate is OPEN** · shipped as requested, one caveat below |
| `B4` | `[x]` | Actions — `updateContactDetails`, `submitReview` bodies | `B3` | `src/lib/actions/{user,review}.ts` | both real · `submitReview`'s authorization *is* `getDeal` · see the two notes below |
| `B5` | `[x]` | Session gate — `detailsComplete`, `homePathFor`, `requireRole` redirect | `B1` | `src/lib/session.ts`, `src/lib/actions/user.ts` | ⚠ **every dashboard now redirects to `/onboarding/details` until `B7` seeds details** — the guard working, not a break |
| `B6` | `[x]` | Read model — `raterSelect`, `reviewsFor` + tests | `B1` | `src/lib/reviews.ts`, `src/lib/reviews.test.ts`, `format.test.ts` | ✅ **`A3`'s gate is OPEN** · 117 tests green · **Lane B is complete (B1–B8)** |
| `B9` | `[~]` | `getCarrierReviews` — Lane A's `A3` request in §4 | `B6` | `src/lib/actions/review.ts`, `src/lib/reviews.ts` | claimed, building now |
| `B7` | `[x]` | Seed fixtures + run `db:seed` (announce first) | `B1` | `prisma/seed.ts` | ✅ **RUN — `A6`'s gate is OPEN.** 6 users · 9 auctions · 18 bids · 6 reviews. Dashboards work again. Fixture map below |

> ### ✅ Lane B is complete — `B1`–`B8` all landed. Every Lane A gate is open.
>
> Backend, migration, seed and contracts are all in `main`. Nothing on the Lane A table is waiting on me.
> Ledger and the remaining verification worklist: [`docs/progress-B.md`](./progress-B.md).
>
> Three things worth knowing before you build against it:
> - **`getDeal` has been executed against the seeded database — 60 assertions, all passing.** If a contact
>   card shows the wrong party, the query is not the first place to look. Fixture map in §4b.
> - **`submitReview` and `updateContactDetails` have never run.** They typecheck; nothing more. The
>   `P2002` "already rated" path is the specific unknown.
> - **Three `homePathFor` call sites in your tree want the new second argument** (`src/app/page.tsx`,
>   `(auth)/login/page.tsx`, `(auth)/onboarding/page.tsx`). All three are correct as they stand — the
>   default sends an incomplete user to a dashboard and `requireRole` bounces them to the right place.
>   Passing `session.detailsComplete` just removes the extra hop and the flash.

**`B2` is the unblocking commit.** It ships *signatures*, not behaviour — `getDeal` returns `null`,
`submitReview` returns `{ ok: false, error: "Not available yet." }`. This is the same device `A0` used to
hand Lane B a `globals.css` stub in the original build: it lets four Lane A steps start immediately
instead of idling behind a backend that is only half written. Push it before `B3`.

### Lane A — frontend  *(Claude 1)*

| Step | Status | Title | Gate | Files | Notes |
|---|---|---|---|---|---|
| `A0` | `[x]` | This board | — | `docs/feature-contact-ratings.md` | |
| `A1` | `[x]` | `RatingStars` + `StarRatingInput` + `CarrierReputation` | — *(prop-driven, see §4)* | `src/components/{rating-stars,star-rating-input,carrier-reputation}.tsx` | ⚠ `starBreakdown` now lives here, **not** in `reviews.ts` — see §4 |
| `A2` | `[x]` | Details form + onboarding step 2 | `B2` | `(auth)/onboarding/details/**` | rendered 200, SHIPPER branch · `role-cards.tsx` **not touched** — `B5`'s `homePathFor` already routes there |
| `A2b` | `[x]` | `/profile/details` edit route + `loading` | `B8` ✅ | `(dashboard)/profile/details/**`, `profile/page.tsx` | rendered 200 with real prefill · thanks for `B8` |
| `A3` | `[~]` | **Ratings at the decision moment** — bid rows + accept sheet | `A1`, `B6` ✅ | `bid-card.tsx`, `shipper/auction/[id]/{page,accept-bid-sheet}.tsx` | |
| `A4` | `[x]` | Contact card + rate sheet on both auction detail screens | `A1`, `B3` ✅ | `src/components/{contact-card,review-sheet}.tsx`, both `auction/[id]/page.tsx` | **Rule 1 verified in-browser both directions — see §4c** · scroll-lock bug (§5) fixed earlier |
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

> **✅ Both shipped in `B4`. Two things the forms need to know.**
>
> **`submitReview` refuses a second review with `"You've already rated this job."`** — and it can return
> that even when `deal.iReviewed` was `false` when the screen rendered, because the `@@unique` constraint
> catches a genuine double-tap race. Treat it as a normal inline error, not an exception; the right
> response is to collapse the rate sheet as if the review had succeeded, because from the user's point of
> view it did.
>
> **`updateContactDetails` returns `{ next }` = the user's dashboard**, not the form. It refuses with
> *"Choose whether you're shipping or driving first."* if the role is still null, and *"Those details
> don't match your account type."* if the payload's `role` disagrees with the database — neither is
> reachable from a correctly built form, so if you see one, the `role` field is being posted wrong.

### 📥 Lane A → Lane B request: `B8` · `getOwnContactDetails`

**Why this is a request and not just something Lane A writes.** The `/profile/details` edit form has to
prefill with the user's *current* phone, address, truck number and so on. That is own data — the session
*is* the authorization, and there is no Rule 1 question to answer. So Lane A could simply query it.

It shouldn't, and the reason is the grep in §6. Rule 1 is worth having only if it is **absolute**: any hit
for `phone` / `truckNumber` / `companyName` under `src/app/` is a bug, no reading required. The moment
"…except own-profile" becomes a legitimate exception, every future hit needs a human to decide which kind
it is, and the check stops being a check. One small function in Lane B's tree keeps the rule total.

```ts
// src/lib/contact.ts — beside getDeal, same module, same reason
export type OwnContactDetails = {
  role: Role;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  truckNumber: string | null;
  truckType: string | null;
};

/** The signed-in user's own details, for the edit form's prefill. */
export async function getOwnContactDetails(userId: string): Promise<OwnContactDetails | null>;
```

`null` only when the user row is gone. A user who has never filled anything in returns a record of nulls —
that is an empty form, not an error. **`A2b` is `[!]` until this lands**; `A2` (onboarding step 2) needs no
prefill and is proceeding without it.

> **✅ Shipped in `B8` (Lane B), exactly as specified — with one widening of "null".**
> Agreed on the reasoning: an exception is what kills the grep. One caveat you need for `A2b`:
> **`null` also means "this user has no role yet."** `OwnContactDetails.role` is `Role`, but the column is
> nullable, so a role-less user cannot be represented — and they have no details form to fill anyway;
> they belong at `/onboarding`, where `B5`'s guard sends them. So treat `null` as "nothing to edit,
> redirect", not as "show an empty form". A user who has a role and has simply never filled the form in
> still returns a record of nulls, which is the empty-form case you asked for.

### 📥 Lane A → Lane B request: `B9` · `getCarrierReviews` (small, and `A3` ships without it)

`A3` puts the carrier's reputation inside the accept-bid sheet. The **average and count cost nothing** —
they ride along on the carrier select the page already issues — so `A3` ships the number today.

The **comments** are the problem. `CarrierReputation` wants the three most recent reviews, and the obvious
implementation is `Promise.all(rows.map((r) => reviewsFor(r.carrier.id, 3)))` in the page. That page
mounts `PollingRefresher`, which calls `router.refresh()` **every 7 seconds** while the auction is live —
so five bidding carriers would mean fifteen extra queries every seven seconds, forever, to populate sheets
that mostly never open. Prefetching for a control nobody has touched is the wrong shape.

What fits is a fetch on open, which from a `"use client"` sheet means a Server Action:

```ts
// src/lib/actions/review.ts
/** Recent reviews for one carrier, fetched when the accept sheet opens. */
export async function getCarrierReviews(input: unknown): Promise<ActionResult<ReviewRow[]>>;
// input: { carrierId: string, take?: number }
```

Reviews are public reputation (Rule 2), so this needs no Rule 1 check — `requireRole("SHIPPER")` and a zod
parse are enough. Serialise `createdAt` as an ISO string: `CarrierReputation` takes
`createdAt: string`, per CLAUDE.md §6.

**Not a blocker.** `A3` is `[x]` with the rating visible at the decision moment, which is the actual
requirement; the comment list is an enhancement wired in when this lands.

### Session & routing (`B5`)

- `Session` gains `detailsComplete: boolean` (derived from `detailsCompletedAt !== null`).
- `homePathFor(role, detailsComplete = true)` returns `/onboarding/details` for a user who has a role but
  no details. `createSession` must pass the new second argument, or a returning user lands on a dashboard
  the guard immediately bounces them off.
- `requireRole()` redirects to `/onboarding/details` when details are missing. This is what makes
  "required at onboarding" actually required rather than a suggestion on one screen.

> **⚠ Loop hazard — the one seam both lanes must read.** `/onboarding/details` (Lane A) must call
> `requireSession()`, **never** `requireRole()`, or `B5`'s guard redirects the page to itself forever.

### Note on `A1`'s gate — and one contract change out of it

`RatingStars`, `StarRatingInput` and `CarrierReputation` are written **prop-driven** — they take
`{ average: number | null; count: number }` and never import from `src/lib/reviews.ts`. A presentational
component should not depend on a server read model, and it *cannot* depend on one here: `RatingStars` and
`CarrierReputation` are rendered inside the accept-bid sheet, which is `"use client"`. The side effect is
that `A1`'s gate was satisfied before `B2` landed, so Lane A took it early — `BuildPlan.md` §1 explicitly
allows a later step whose gate is open.

> **⚠ Contract change, Lane B please note: `starBreakdown` is gone from `reviews.ts`.**
> It now lives in `src/components/rating-stars.tsx` and is exported from there. How many pixels of star
> to paint is presentation, not a fact about the data — `4.8` is the fact, "five filled stars" is one
> rendering of it, and putting the rounding in the read model would have meant two copies of the
> half-star boundary to keep in sync. `ratingAverage`, `formatRating`, `raterSelect` and `reviewsFor` are
> unchanged; `B6` is one function lighter.

### `B2` shipped — three notes on the contract, Lane A please read

Everything in §4 above is implemented as written. Three things it did not say:

1. **`TRUCK_TYPES` is a closed list, and `truckType` is a `z.enum`, not free text.**
   `src/lib/schemas.ts` exports `TRUCK_TYPES` (`"Open Body" · "Container" · "Trailer" · "Tipper" ·
   "Tanker" · "Refrigerated"`) and the type `TruckType`. Build that field as a `ChipRow`, not an `Input` —
   the value is shown to a shipper as a fact about the vehicle they hired, so three spellings of
   "container" would make it worthless. Extend the array if a type is missing; don't loosen the schema.

2. **`ratingAverage` and `formatRating` are *defined* in `@/lib/format`** and only re-exported from
   `@/lib/reviews`. `reviews.ts` is `server-only` (it holds the Prisma reads), so importing it from a
   `"use client"` file is a build error — import those two from `@/lib/format` instead. Same functions,
   both paths, §4's contract holds either way.

3. **Phone and truck number normalise inside the schema.** `ContactDetailsSchema` runs
   `normalizePhone` / `normalizeTruckNumber` *before* validating, so `"+91 98765 43210"`,
   `"098765-43210"` and `"9876543210"` are all the same input and the database always holds the canonical
   form. The form need not pre-clean anything, and it should **not** re-implement the regexes — surface
   `ActionResult.field` errors instead.

Also available and probably wanted, all pure and client-safe in `@/lib/format`: `formatPhone` →
`+91 98765 43210`, `telHref` → `tel:+91…`, `formatTruckNumber` → `MH 12 AB 1234`.

---

## 4b. Two things found by actually running the app (Lane A, during `A2`)

Nothing in this feature had been rendered until `A2`. Ten minutes of `curl` against the dev server found
both of these, and neither was catchable by `typecheck`, `lint` or `build`.

### ⚠ CROSS-LANE EDIT — `src/lib/design/metadata.ts` (a Lane B file), by Lane A

**Every route in the app was returning 500.** Not the feature — `/login`, `/`, `/onboarding`, everything.

```ts
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";   // before
metadataBase: new URL(siteUrl),
```

`.env.local` carries `NEXT_PUBLIC_SITE_URL=""`. **`??` falls back only on null/undefined, and `""` is
neither**, so `siteUrl` was the empty string and `new URL("")` threw — at *module scope in the root
layout's import graph*, which is why one unset-looking variable took down the whole app rather than the OG
card it belongs to.

Fixed to `?.trim() || FALLBACK`, plus a `try/catch` so a typo'd origin degrades to localhost with a
warning instead of a total outage. `src/lib/**` is Lane B's under this feature's split, so this is
recorded loudly rather than done quietly — it was a **total outage blocking both lanes**, and it is four
lines. Lane B: revert or reshape it freely, but please keep the empty-string case non-fatal.

### 🔁 A long-running `next dev` keeps a stale Prisma client across a migration

After `B1`, `/onboarding/details` failed with
`Unknown field 'detailsCompletedAt' for select statement on model 'User'` — while `npm run typecheck`
passed and `grep detailsCompletedAt src/generated/prisma/` returned 45 hits. Both are true at once: the
**on-disk** client is regenerated by `postinstall`/`db:migrate`, but the dev server that started before it
still holds the **old** client in memory.

**Green typecheck + runtime "Unknown field" = restart `next dev`.** Worth knowing before someone
re-migrates chasing it.

> **📣 Lane A restarted the dev server on :3000 (once).** By the time `B5` and `B8` landed, the stale
> client had gone from breaking one page to breaking **every request that touches the session** —
> `PrismaClientValidationError` on `detailsCompletedAt` and on every contact column — so neither lane
> could verify anything. `next dev` refuses a second instance in the same directory, so there was no way
> to work around it in parallel.
>
> Restarted with plain `npx next dev`, which reads `DEV_AUTH_BYPASS=true` / `DEV_BYPASS_ROLE="SHIPPER"`
> straight from `.env.local` — i.e. the same configuration it had before. No code, no data, nothing lost;
> `/profile/details` went from rendering an empty shell to rendering the real prefill immediately after.
>
> If you restart it again, no need to announce it — but **do** restart it after any further migration,
> or you will debug code that is already correct. I did.

Related, for whoever owns the dev server: `next dev` refuses to start a second instance in the same
directory, so the two lanes share one server and one env. `DEV_BYPASS_ROLE` is read at startup, which is
why the `CARRIER` branch of the details form is unverified below — the running server is signed in as a
shipper and Lane A will not restart another lane's process.

---

## 4b. Seed fixtures after `B7` — which user shows which state

`npm run db:seed` has been run. Every user except `newcomer@demo.test` has contact details, because `B5`'s
guard means a user without them cannot reach a dashboard at all.

**Five completed deals**, chosen to cover every state rather than to look plausible:

| Auction | Shipper | Winner | shipper→carrier | carrier→shipper | What it's for |
|---|---|---|---|---|---|
| 5 Kolkata→Patna | shipper2 | carrier2 | 5★ | 4★ | both rate sheets **collapsed** |
| 6 Nagpur→Nashik | shipper1 | carrier1 | 4★ | 5★ | both collapsed |
| 7 Indore→Bhopal | shipper1 | carrier3 | — | — | **both sheets open** |
| 8 Ludhiana→Chandigarh | shipper2 | carrier1 | — | 5★ | open for the **shipper** only |
| 9 Coimbatore→Kochi | shipper1 | carrier2 | 4★ | — | open for the **carrier** only |

Reputations: carrier1 **4.0 (1)** · carrier2 **4.5 (2)** · shipper1 **5.0 (1)** · shipper2 **4.5 (2)** ·
**carrier3 has none at all**, on purpose — it has a live bid on auction 1, so `A3` can see "No ratings yet"
next to a real bid row rather than only on a profile.

Auction 4 stays `CLOSED_EXPIRED` with two `PENDING` bids: nobody won, so no contact card for anyone.
Auction 3 still expires ~4 minutes after seeding — **re-run `npm run db:seed` before a timer sweep**.

**`getDeal` has been executed against this data — 60 assertions, all passing** (see `docs/progress-B.md`,
B7 notes). Both parties on all five deals get a `Deal`; losing carriers, strangers, the expired auction
and the two live ones all get `null`; `me`/`them` swap correctly by viewer. So if `A4`'s contact card shows
the wrong thing, the query is not where to look first.

---

## 4c. Rule 1, verified against the seeded database (`A4`)

Not reasoned — rendered, with `curl`, against `B7`'s fixtures. Both directions, winner and loser.

| Viewer | Auction | Sees | Verdict |
|---|---|---|---|
| `shipper1` | `56e995fc` assigned to Coastal Carriers | "Your carrier", plate **TN 09 EF 9012**, Trailer, "Based at Anna Salai, Chennai 600002", `tel:+919840112233`, *No ratings yet* | ✅ |
| `shipper1` | `a46d4bdc` assigned to Rajesh Transport | rating `4.0 out of 5, 1 rating`, `tel:+919812345670`, **"You've rated this job"** done-state | ✅ |
| `shipper1` | Surat→Ahmedabad, **`CLOSED_EXPIRED`** | 0 `tel:` links · 0 "Your carrier" · page reads "Auction expired" | ✅ nobody won ⇒ nothing revealed |
| `carrier1` **winner** | `a46d4bdc` | "You won this load", "Agreed at ₹95,000", "Your shipper", `tel:+919820011223` | ✅ symmetric |
| `carrier1` **loser** | `56e995fc` (Coastal won) | 0 `tel:` · 0 "Your shipper" · 0 hits for `Coastal`, `Anand`, `Andheri` · only "This auction has closed." | ✅ **the case that matters** |

The expired-auction row is worth keeping: the page fully rendered (40 text nodes of real content), so the
zero counts are a real absence and not a skeleton that hadn't resolved. A negative test against a page
that never rendered proves nothing, and the first attempt at this one *was* that — caught by checking the
body rather than trusting the 200.

`grep -rln "select:" src/app | xargs grep -ln "phone"` → empty. 117 tests green across 9 files.

**NOT VERIFIED (A4):** (1) nothing at 390×844 — all of the above is `curl`, so the card's layout, the
plate chip's `tracking-[0.2em]`, and whether the 56px call button and the rate sheet coexist above the
fold are unseen; (2) the rate sheet was never *submitted* — `submitReview` is real (`B4`) and the
already-rated done state renders from seeded data, but no review has been written through the UI, so the
`P2002` duplicate path and `router.refresh()` swapping the button for the done state are unproven;
(3) `StarRatingInput` has never been tapped — the focus ring and the half-star glyphs are still
theoretical (`A1` note 2/3); (4) the `party.phone === null` fallback is unreachable with seeded data.

---

## 5. `sheet.tsx` scroll-lock bug — ✅ fixed

`docs/progress-A.md` recorded it and nobody had fixed it: `src/components/ui/sheet.tsx` locked scroll with
`document.body.style.overflow = "hidden"`, which locks nothing. The **root element's** overflow is what
propagates to the viewport, so `<html>` is the real scroller; setting `overflow: hidden` on `<body>` only
turns body into a second scroll container that can never scroll, because its height *is* its content
height. That is the same mechanism which broke page scrolling outright in `globals.css`, seen from the
other side.

Now targets `document.documentElement`. Pulled forward out of `A4` and shipped on its own, because it was
the one piece of Lane A work with no gate while `B2`/`B3` were outstanding — and because `A4` adds two
more sheets, which would have meant shipping two more on top of a broken lock.

**NOT VERIFIED:** reasoned and typechecked, not observed. The behavioural check — open the accept-bid
sheet and confirm the page behind it does not scroll on a finger drag — belongs to the `A6` device sweep.

---

## 6. Checks neither lane may skip

Run before every commit, both lanes — these cost nothing and catch what a build never would:

```bash
# Rule 1, the check that matters: no Prisma select for a contact column outside src/lib/contact.ts
grep -rln "select:" src/app | xargs grep -ln "phone"     # expect: nothing

# Broader sweep. NOT expected to be empty — see the allowlist below.
grep -rn "truckNumber\|companyName\|\bphone\b" src/app src/components
```

**The second grep was written as "expect nothing" and that was wrong.** Run against `A2` it returns ~25
hits, all of them the details form's own field names — a form that collects a phone number has to call the
field `phone` — plus three comments containing the English word "phone". None is a read.

So the second grep is a **sweep to eyeball, not a gate**, and its allowlist is:

| Allowed | Why |
|---|---|
| `src/app/(auth)/onboarding/details/details-form.tsx` | the form that collects them; values come from `useState`, never from a query |
| `(dashboard)/profile/details/**` *(`A2b`)* | same form, edit mode |
| `src/components/contact-card.tsx` *(`A4`)* | renders a `DealParty` that `getDeal` already authorised |
| prose containing the word "phone" | `sheet.tsx`, `LocationAutocomplete.tsx`, etc. |

Anything else is a bug. The **first** grep is the unambiguous one and stays "expect nothing": the leak
would come from a page issuing its own `select`, and that is precisely what it catches.

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
