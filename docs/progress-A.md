# Lane A Progress — foundation, auth, Shipper vertical, cron, deploy

Owned by **Claude 1**. Step definitions: [`../BuildPlan.md` §6](../BuildPlan.md).

Status markers — `[~]` goes in BEFORE the work starts and is pushed on its own (BuildPlan §1 step 4):
`[ ]` not started · `[~]` in progress right now · `[x]` done + pushed · `[!]` blocked on a gate

| Step | Status | Title | Gate | Commit | Notes |
|------|--------|-------|------|--------|-------|
| A0 | [x] | Scaffold, database, container, Cloud Build | — | `701b8b5` | opened B0 |
| A1 | [x] | Firebase auth + session | — | `58830ab` | opened B3 + B4 |
| A2 | [x] | Onboarding & role routing | — | `3853f9f` | |
| A3 | [x] | Shipper dashboard | `auction-card.tsx` + `mobile-nav.tsx` | | rendered against seed data |
| A4 | [x] | Create auction + Google Maps routing | `ui/button.tsx` + `input.tsx` | | Places + Distance Matrix; 43 tests green |
| A5 | [x] | Shipper auction details + live bids | `timer.tsx` + `bid-card.tsx` | | by Claude 2 — see note below · **A6 gate open** |
| A6 | [x] | Accept-bid transaction + cron | A5 | | |
| A7 | [x] | Shipper history + deploy docs | A6 | | |

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
- **A3** — rendered and read at desktop width only; **not seen at 390×844**. Most likely to be wrong: the
  `TopAppBar` trailing bell plus the avatar and wordmark may crowd a 390px bar. Also noticed while
  rendering, in **Lane B's** `AuctionCard`/`Timer`: the server HTML contains "Live Expired closed" all at
  once, i.e. every status branch renders before hydration picks one. Harmless once JS runs, but it is what
  a no-JS or slow client sees. Reported under HANDOFF TO B.
- **A4** — **no Google Maps key is configured**, so nothing was exercised against the real APIs. The
  Distance Matrix parser is unit-tested against recorded response shapes, but `resolveRoute`'s actual HTTP
  call, the Places script loader, and the whole suggestion path have never run. Most likely to be wrong:
  (a) the `AutocompleteSuggestion.fetchAutocompleteSuggestions` field names — `mainText.matches[0].startOffset`
  is the shape I expect for the match highlight and it may be `matchedSubstrings`-style instead;
  (b) `place.fetchFields(["location"])` may need `displayName` too, or return a `LatLngLiteral` rather than
  the `LatLng` whose `.lat()` I call; (c) the suggestion list is `absolute` inside a card with
  `overflow-hidden` nowhere, but if a parent ever clips it the dropdown will vanish. Also unverified at
  390×844: whether four suggestion rows plus the attribution strip clear the on-screen keyboard.

## DEPS ADDED
_Packages this lane installed — the other lane must re-run `npm install`._

- `@types/google.maps` (dev, `672d792`) — types only, no runtime code, no bundle impact.

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

### ✅ RESOLVED by Lane B — `favicon.ico` RGBA (`f5b7b62`)

Cloud Build failed in `next build` on `src/app/favicon.ico`:
`Format error decoding Ico: The PNG is not in RGBA format!`

**Diagnosis (Lane A, `ecf29fb`).** B0's hand-rolled rasteriser wrote PNGs with **colour type 2 (RGB)**;
Turbopack's ICO decoder accepts only **colour type 6 (RGBA)**. Both `src/app/favicon.ico` and
`public/icons/favicon.ico`, all three sizes.

**Fixed by Lane B in `f5b7b62`** — verified on `main`: 3 images, 867 bytes, all `colorType=6`. A clean
`npm run build` here now passes.

**Note on process.** The user told Lane A to fix it directly, so I converted both files locally
(decode → add opaque alpha → re-encode, artwork pixel-identical). Lane B had already pushed the same fix,
and my result was byte-identical, so **there was nothing to commit** — the conversion is discarded and
`f5b7b62` stands as the fix. Duplicated effort, no duplicated code: the cost of both lanes chasing one
blocker in a shared checkout.

Why B0's local build missed it: Turbopack only re-decodes the icon on a **clean** build. `rm -rf .next`
before trusting an icon change.

### Timer/AuctionCard renders every status branch at once (A3 observation)
Server HTML for `/shipper` contains `Live Expired closed` in sequence on each card — all three status
branches present before hydration. Reproduce: `curl -s localhost:3000/shipper` and strip tags. Likely a
render-all-then-hide, or a `suppressHydrationWarning` path in `timer.tsx` that emits each state. Cosmetic
once JS runs; visible on a slow or JS-less client, and it makes the card's accessible text read
contradictorily to a screen reader.

### Earlier items (all actioned by Lane A)
1. Shell API — noted; `A3`/`A5` compose `TopAppBar` + `AppScreen` + `MobileNav`, `A4` passes `hasNav={false}`.
2. Metadata module wired into `layout.tsx` (`c6fd860`).
3. `src/app/favicon.ico` replacement accepted — see the blocker above.
4. `NEXT_PUBLIC_SITE_URL` added to `.env.example` (`c6fd860`).


## A4 follow-up — Places autocomplete, live distance, route map (user directive)

Real Maps keys were supplied mid-session, which turned A4's whole `NOT VERIFIED` list from
speculation into something testable. Three defects and two additions.

### The bug that made autocomplete impossible

`LocationAutocomplete` resolved its loader on `script.onload` and then read
`window.google.maps.places.AutocompleteSuggestion`. Under `loading=async` the bootstrap defers the
library payloads, so at `onload` that property is **undefined** — the component set `degraded = true`
and fell back to a plain text box *with a perfectly valid API key*. It could never have worked.

Fixed in the new `src/lib/maps-client.ts`: resolve on the API's own **`callback=` parameter**, then
`await google.maps.importLibrary(name)`. Two intermediate attempts are worth recording because the
first looked right and was not:

1. `onload` → read the namespace. Fails always (the original bug).
2. `onload` → `importLibrary(...)`. Fails *intermittently* — verified in-browser, console read
   `window.google.maps.importLibrary is not a function`. `onload` fires before the bootstrap has
   finished wiring `google.maps`; a second later the function exists, which is what makes this look
   like a flake rather than a race.
3. `callback=` → `importLibrary(...)`. Correct. **Verified in-browser**: script injects, library
   loads, `importLibrary` is a function at first call, no console errors.

### Also fixed

- **`new Place({ id })` → `prediction.toPlace()`.** Only `toPlace()` carries the autocomplete session
  token into `fetchFields`, so the old code billed every session as a separate Place Details lookup
  on top of per-keystroke Autocomplete requests. A4's suspect (b) about `fetchFields` shapes was
  right that this line was wrong, for a different reason than guessed.
- **The create screen's dead bottom padding.** `page.tsx` passed `className="… pb-[120px]"` to
  `AppScreen`, which sets its own `pb-[calc(…)]`. Two arbitrary values at equal specificity are
  resolved by **stylesheet order, not class order** — AppScreen's won, so the page had 24px of
  clearance under an 89px sticky footer and the last field sat beneath it. Clearance now lives on the
  form. Measured after the fix: `formPadBottom 112px` vs `footerHeight 89px`.
- **`<form className="contents">` → a real flex column.** `display: contents` removed the form's box,
  so `AppScreen`'s `space-y-*` (which selects `main > * + *`) only ever saw the `<form>` and the
  sections below got **no vertical rhythm at all**. Now `gap-stack-lg`, measured `rowGap: 24px`.

### Added

- `previewRoute` Server Action + `RoutePreviewSchema` — live distance/ETA on the create form once
  both ends are geocoded. Server-side because Distance Matrix runs on the **server** key. It is a
  preview only; `calculateRouteAndCreateAuction` still re-resolves the route at submit, because a
  number the client received is a number the client could have edited.
- `src/app/(dashboard)/shipper/create/route-map.tsx` — map preview of the route. Placed beside the
  page, **not** in `src/components/`, which is Lane B's tree (§3). `gestureHandling: "cooperative"`
  so a one-finger drag scrolls the page instead of panning the map.

### `DirectionsService` is deprecated — the map uses the Routes API

The browser console flagged it during verification: **`google.maps.DirectionsService` was deprecated
on 25 Feb 2026**, superseded by `google.maps.routes.Route.computeRoutes`. The first cut of
`route-map.tsx` used `DirectionsService` + `DirectionsRenderer` and logged a deprecation warning on
every render; it now calls `computeRoutes` and draws the returned `path` itself.

Two knock-on decisions:

- **No marker library.** `DirectionsRenderer` used to supply the A/B markers for free. Its
  replacements both cost something — `AdvancedMarkerElement` needs a cloud-side Map ID, and
  `google.maps.Marker` is *also* deprecated — so the endpoints are `SymbolPath.CIRCLE` icons on a
  zero-opacity polyline. No new config, no second deprecation warning.
- **Distance Matrix is legacy too** (its modern form is the Routes API's `computeRouteMatrix`). It is
  not deprecated and it works, so `src/lib/maps.ts` is untouched — but it is the next one to move.

### Google Cloud config — resolved during the session

Probed the live keys directly (`scratchpad/probe-maps.mjs`, statuses only, never the key). First run
found three APIs blocked by **API restrictions on the client key**; the user enabled them and the
final state is:

| API | Key | Result |
|---|---|---|
| Distance Matrix | server | **OK** — powers the distance strip and the stored value |
| Maps JavaScript | client | **OK** |
| Places API (New) | client | **OK** (was `PERMISSION_DENIED`) |
| Routes | client | **OK** (Directions was `REQUEST_DENIED`; superseded, left disabled) |

The client key needs exactly three: *Maps JavaScript API*, *Places API (New)*, *Routes API*.

### VERIFIED in-browser at 375×667, end to end

- Typing "Mumbai" returns 4 suggestions with the matched substring highlighted, plus the Google
  attribution row. Selecting one resolves via `toPlace()`/`fetchFields` to `"Mumbai, Maharashtra"`.
- With both ends picked, the strip reads **`148 km · ~2h 37m`** — real Distance Matrix data through
  `previewRoute`. Changing the drop-off to Nashik re-resolved to `187 km · ~3h 24m`, so the
  `key`-based dedupe re-fires on a genuine change and not otherwise.
- The map draws the **road route** in `#ff6b00` with endpoint dots, 180px tall, 9 tiles.
- Before the Routes API was enabled, the same flow fell through to the dashed straight line and the
  "Showing a direct line" caption without throwing — so **both** branches are proven, not just the
  happy one.
- **Scrolling:** 1106px of content in a 667px viewport. At `scrollY === maxScroll` the last paragraph
  bottoms out 47px **above** the sticky footer. Before the fix the page had 24px of clearance under
  an 89px footer.
- `npm run build` exit 0; `typecheck`, `lint`, and 74 tests green.

**NOT VERIFIED (A4 follow-up):** (1) nothing was tested at a true 390×844 — verification ran at
375×667, so the map's 180px box and the four-row suggestion list have not been checked against the
on-screen keyboard on a real device; (2) the form was never actually **submitted** — the create path
still has A4's original unverified line, so a real auction has not been written with coordinates and
a distance; (3) `previewRoute` bills one Distance Matrix element per pickup/drop-off change, which
the dedupe bounds but no test pins; (4) the `Route.computeRoutes` failure branch was proven while the
API was *disabled*, not while it was enabled-but-erroring.

## Blockers log
_`<timestamp> — waiting on <gate>; re-checking in 60s`_

## ⚠ Cross-lane: Claude 2 is working A5 onward (user instruction)

Lane B finished at `B6`, and the user then told Claude 2 to work Lane A's tasks. This breaks
CLAUDE.md §0's "never work the other lane's step", so it is recorded loudly rather than done quietly.

**Claude 2 has taken `A5`, and will continue to `A6`/`A7` unless told otherwise.**
**`A3` is deliberately untouched** — it was `[~]` when this started, meaning Claude 1 is inside it, and two
agents editing one screen in one shared checkout is how the favicon fix got done twice.

Claude 1: keep `A3`. If you pick up `A5`/`A6`/`A7`, say so here first and Claude 2 will drop it.

## A5 notes (by Claude 2)

`/shipper/auction/[id]` + `loading` + `error` + `accept-bid-sheet`, from Stitch `d8dfb998…`, plus
`src/lib/bids.ts` (+12 tests).

**The §3.3 reduction is the substance, so it is pure and tested.** A carrier may bid many times on one
auction — that is what a reverse auction is — so the list collapses to **one row per carrier, their latest
bid**, *before* anything is ranked. Without that, a carrier who bid three times looks like three
competitors. "Best Price" is the global minimum with **ties going to the earliest bid**.

`latestBidPerCarrier` deliberately keeps the *latest* bid, not the lowest, because that is what §3.3 says.
They coincide today only because `submitBid` guard 6 refuses a bid that does not undercut the carrier's own
previous one. A test pins them apart, so relaxing that guard later surfaces here rather than in the UI.

**404, not 403, for another shipper's auction.** A "forbidden" page confirms the id exists, which is a
small enumeration oracle over uuids. "Not found" tells someone poking at ids exactly as much as they should
get.

**Terminal states render read-only** with a status banner — assigned (with the winner and price) or
expired ("nobody won"). §3.2 has no arrow out of either, so an accept button there would be a control that
cannot work. `PollingRefresher` also stops once the auction is not live.

### Deliberate departures from the Stitch markup

| Mockup | Shipped | Why |
|---|---|---|
| Carrier ratings — "★ 4.8 (124 trips)" | dropped | **There is no rating data in the schema.** Ratings are on the deferred backlog; rendering a number we do not have would be fabrication |
| "Sort by: Price ▾" | dropped | §3.3 fixes the order (amount ascending). A dropdown with one option is a dead control |
| "Flatbed" truck type | dropped | Not in the schema either |
| `150 km` static | `formatRouteSummary` | Real Distance Matrix data, degrading to "Distance unavailable" (§10.4) |
| Timer `00h 45m 12s` | `<Timer>` | Lane A's own tested formatter, via B2's component |

**One change to a file outside A5's list:** `acceptBid` in `src/lib/actions/auction.ts` was widened from
`()` to `(_input: unknown)` so the accept sheet could be built against the real call shape. **The body is
untouched** — still the honest "not available yet" refusal. A6 fills it in.

**NOT VERIFIED (A5):** nothing rendered. Most likely to be wrong, in order: (1) the accept flow end to end,
since `acceptBid` is still a placeholder — the button, the sheet and the error path all work, but pressing
through shows the refusal until A6; (2) the seeded auction 5 (`COMPLETED_ASSIGNED`) rendering its assigned
banner with the right winner; (3) a carrier who bid twice appearing once, which is tested in isolation but
unproven against real rows; (4) another shipper's auction 404ing.

## A6 notes (by Claude 2)

`acceptBid` per §5.4, `/api/cron` per §5.5, `docs/cloud-scheduler.md`, and
`src/lib/{auction-close.ts,__tests__/auction-close.test.ts}`.

**The race is the whole point of `acceptBid`.** A shipper accepting and cron expiring can reach the same
auction at the same instant. Read-then-write loses: both see `ACTIVE`, both proceed, and the row ends up
assigned *and* expired. The fix is the status-guarded `updateMany` — `WHERE status = 'ACTIVE' AND endTime >
now()` is atomic, whoever flips it first wins, and the loser gets `count === 0` and aborts. **Nothing is
decided by anything read beforehand**; the ownership check above the transaction exists only to fail early
with a better message. Serializable isolation on top, because "assigned with no accepted bid" and "two
accepted bids" are states the schema cannot recover from.

`AuctionNoLongerActiveError` is a class, not a string, so the `catch` can tell "someone got there first"
(ordinary — surfaces as *"This auction just closed."* and refreshes) from a real database failure (not).

**The sweep cannot un-assign a won auction**, and that is structural rather than careful: its filter
requires `status: 'ACTIVE'`, and `acceptBid` has already moved the winner's row to `COMPLETED_ASSIGNED`.
The same guard from both directions. Bids on an expired auction stay `PENDING` — nobody won, and marking
them `REJECTED` would claim a decision was made.

**`expiredAuctionWhere` and `shouldClose` are defined together in `auction-close.ts`.** The rule really
lives in a Prisma `WHERE`, which no unit test can execute, so writing a predicate that merely *resembles*
the query would test nothing. Both come from one statement of the rule and the test asserts they agree case
for case — edit one and the other fails. It also pins `lte` (an auction ending exactly now is over), which
must match `submitBid` guard 4 or there is a millisecond where bids are refused but the auction is open.

**Cron auth fails closed.** An unset `CRON_SECRET` rejects every request rather than running
unauthenticated — a missing env var must not become an open "close every auction" button. Comparison is
`timingSafeEqual`. `GET` is accepted alongside `POST`: the sweep is idempotent, and a silent 405 on
Scheduler's retry path would look like a working schedule that never runs.

**NOT VERIFIED (A6):** nothing exercised against the database. Most likely to be wrong, in order:
(1) whether Neon accepts `Serializable` on the pooled connection — if it errors, the transaction needs the
unpooled URL or a lower isolation level, and the guarded `updateMany` still carries the correctness;
(2) the actual race, which needs two concurrent callers to observe — the unit test covers the predicate,
not the concurrency; (3) `{ closed: n }` counts against seeded auction 3 (ends ~4 min out); (4) the 401
path with a real `CRON_SECRET` in Cloud Run.

## A7 notes (by Claude 2)

`/shipper/history` + `loading` + `error`, `docs/deploy.md`, and a `history` variant on `AuctionCard`.

**History shows only terminal auctions**, newest first. No `PollingRefresher` and no per-row `Timer`:
§3.2 has no arrow out of either terminal state, so nothing on this screen can change — polling would be a
request every 7s to re-render identical rows, and a countdown per row would be one interval each counting
down to a deadline that already passed. The outcome replaces them: assigned rows show the winning ₹ in
`tertiary`, expired rows show the bid count, because "3 bids and still nobody won" is the useful fact.

**Secret audit (accept criterion) — clean.** The yaml/Dockerfile grep returns exactly one hit: the
documented `postgresql://build:build@localhost` placeholder, never connected to. `cloudbuild.yaml` carries
all 12 secrets from §9.3, split correctly — 7 runtime via `--set-secrets`, 5 public `NEXT_PUBLIC_*` via
build args, and `GOOGLE_MAPS_SERVER_API_KEY` deliberately absent from `availableSecrets` so it cannot
become a build arg by accident.

### Lint regression caught here, fixed across both lanes' files

`npm run lint` began failing during this step with **4 errors it had not raised before** — React's compiler
rules activated on a dependency bump. All four were real:

- **`Date.now()` in a Server Component body** (both auction detail pages). Extracted to `isPastDeadline` in
  `auction-close.ts`, beside the `lte` boundary it shares with the sweep and `submitBid` guard 4. The
  complaint is fair even server-side: the value is request-scoped, not render-scoped.
- **Synchronous `setState` in an effect** (`timer.tsx`, `offline-banner.tsx`), both now syncing on a
  macrotask. This one mattered: `Timer` mounts once per card on a feed and `OfflineBanner` sits in
  `AppShell`, so each was cascading an extra pre-paint render on every route.

Worth carrying into verification: **these files passed lint earlier in the build.** Green before today is
not green now — re-run everything rather than trusting an earlier pass.

**NOT VERIFIED (A7):** nothing rendered. Most likely wrong: (1) history against seeded auctions 4 and 5 —
whether the assigned row finds its accepted bid and shows the right ₹; (2) `docs/deploy.md`'s rollback and
rotate commands, written from the config rather than executed; (3) the `history` variant at 390×844, where
a long material name and a ₹ amount share one row.

## VERIFICATION PASS (BuildPlan §7.2) — run by Lane A against `main`

| Step | Result |
|---|---|
| `V1` typecheck | ✅ zero errors |
| `V2` lint | ✅ zero errors (Lane B cleared the two it owned) |
| `V3` test | ✅ **74 passed / 7 files** |
| `V4` build | ✅ all 12 routes compile |
| `V6` greps | ✅ see exceptions below |
| `V8` route sweep | ✅ see below |
| `V5` 390×844 · `V7` PWA install · `V9` a11y | ⏳ not run — need a real device/browser |

**V6 accepted exceptions** (both deliberate, neither a token violation):
- `google-button.tsx` — `#4285F4 / #34A853 / #FBBC05 / #EA4335` are Google's brand colours in the "G"
  mark. They must be exact and cannot be tokens.
- `global-error.tsx` (Lane B) — raw hex is unavoidable: that boundary renders when the CSS itself may have
  failed, so it cannot depend on Tailwind.
- `#ff6b00` in `globals.css` / `tokens.ts` is **not** a PRD leak — it is `primary-container` from the Stitch
  token set (CLAUDE.md §4.1). Only `#0F172A / #F8FAFC / #020617 / #10B981 / #EF4444` would be, and none appear.

**V8 route sweep** — shipper: `/shipper`, `/shipper/create`, `/shipper/history`, `/shipper/auction/[id]`
all 200. Carrier: `/carrier`, `/carrier/bids`, `/profile` all 200. `/api/cron` without a bearer → **401**.
Cross-role guard verified: a CARRIER hitting `/shipper` gets `NEXT_REDIRECT;replace;/carrier;307` in the
stream, and an `RSC: 1` request returns a real **307**.

> **Trap worth recording.** `curl /shipper` as a carrier returns **200**, which looks like the guard has
> failed. It has not — a route with `loading.tsx` streams its shell with a 200 before the redirect
> resolves, so what curl captures is the skeleton. Verify guards with an `RSC: 1` header, or you will chase
> a bug that is not there. I did.

**Stale seed data.** The seeded auctions were created with relative end times and have all now expired, so
`/carrier` correctly shows its empty state. Re-run `npm run db:seed` before any UI pass — an empty feed is
the data's age, not a defect.

## v1 status
Both lanes code-complete. Deferred backlog: Nearby/geo filtering (needs carrier location, not route
distance), notifications, service worker, dark-mode verification, ratings — plus `V5`/`V7`/`V9`, which
need a real device, and the entire Google Maps path, which needs API keys.

## Fix: page could not be scrolled by finger or wheel (`globals.css`)

**Symptom.** On any screen taller than the viewport, dragging or scrolling did nothing. `window.scrollTo()`
worked, so the page was genuinely scrollable — only *input-driven* scrolling was dead.

**Root cause — the `body` rule in `src/app/globals.css`.** It repeated two declarations that `html`
already carried:

```css
body { overscroll-behavior: none; overflow-x: hidden; }
```

The root element's overflow is propagated to the viewport, so `html` is what actually clips horizontally
and stops the rubber-band, and `html`'s own used overflow becomes `visible`. Body's copies were therefore
redundant — and jointly fatal:

1. `overflow-x: hidden` on a non-propagating element forces its `overflow-y` to compute to `auto`, so
   `<body>` became its own scroll container. Body's height is its content height, so its `scrollHeight`
   always equals its `clientHeight` — it can never scroll a single pixel.
2. Wheel/touch hit-tests to that dead scroll container first. It would normally *chain* up to the viewport
   scroller, but `overscroll-behavior: none` on the same element forbids exactly that.

So every gesture was absorbed by `<body>` and never reached the viewport. `window.scrollTo()` was
unaffected because it addresses the scroller directly, bypassing hit-testing — which is why this presented
as "scrolling is broken" rather than "the page is too short".

**Fix.** Drop both declarations from `body`; keep them on `html`, where they do the intended work.

**Evidence.** Measured over CDP in headless Chrome (mobile emulation) against the dev server. On a bare
`<div style="height:3000px">` page with no app code: scrolls (`scrollY` 120) → add the app's `html`+`body`
rules: stuck at 0 → remove only `body`'s two declarations: scrolls again (120). On `/carrier` with content
forced past the fold, wheel `scrollY` went 0 → 200 at 390×844, 375×667 and 360×640, while `scrollX` stayed
0 and `scrollWidth == clientWidth` at all three, so horizontal clipping did not regress.

**NOT VERIFIED:** no `typecheck`/`lint`/`build` run (CSS-only change; §10 defers them). Touch-gesture
scrolling could not be confirmed — CDP touch synthesis is inert in this headless build, proven by a control
test where a plain tall page also failed to scroll by touch but scrolled by wheel. The wheel and touch
paths share the same hit-test-and-chain logic that was at fault, so the fix should cover both, but **the
one thing to re-check on a real phone is a finger drag.** Rubber-band suppression on iOS is also unverified
here; it now rests solely on `html`, which is the correct element for it.

**Ownership note.** `globals.css` is Lane B's file (BuildPlan.md §3). Edited by Lane A because Lane B is
code-complete (`docs/progress-B.md`: all steps `[x]`), so there was no concurrent writer to clobber, and
the user asked for this fix directly.

**Adjacent bug found, NOT fixed** (out of scope, Lane B's `src/components/ui/sheet.tsx:56`): the sheet's
scroll lock does `document.body.style.overflow = "hidden"`, which does not lock anything — `<body>` is not
the element whose overflow propagates to the viewport, so the page still scrolls behind an open sheet. It
needs to target `document.documentElement` instead. This predates the change above and is unaffected by it.
