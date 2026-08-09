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

## ⚠ Cross-lane: Lane A edited Lane B files for the carrier route map (user directive)

CLAUDE.md §3 says never edit the other lane's files. This did, on explicit user direction, so it is
recorded loudly rather than done quietly — same treatment as the Claude-2 entry below.

**Lane B files touched:** `src/app/(dashboard)/carrier/auction/[id]/page.tsx` (four coordinate fields
added to the `select`, plus the disclosure), `src/lib/design/metadata.ts` (the OG fix below), and two
new files under `src/components/`.

**This is new scope, not a fix.** TechnicalDocument §10.4 enumerates four surfaces for route data and
specifies a distance *string* at each; no map is specified for the carrier anywhere in §10 or the PRD,
which calls that card a "Minimal summary of the route". The distance string was already correct on
both carrier surfaces before this change.

### Why a disclosure and not an inline map

- **The CTA stays above the fold.** Measured before the change: *Submit Bid* bottoms out at 651px in a
  667px viewport and the page does not scroll at all. The 180px map inline would have pushed it under.
- **§10.5 says "never recompute on read."** Always-on would be one `Route.computeRoutes` per carrier
  per load browsed. Behind a tap it costs a call only when someone wants the picture — **verified: with
  the disclosure collapsed there is no `truckinggo-maps-js` script in the DOM and `window.google` is
  `undefined`**, so an unopened bid screen costs nothing.
- **The feed is deliberately excluded.** Its query has no `take:`, so N maps per render is exactly what
  §10.5 forbids.

### Ownership: `route-map.tsx` moved into the carve-out

`src/app/(dashboard)/shipper/create/route-map.tsx` → `src/components/route-map.tsx`, joining
`LocationAutocomplete.tsx` as a Lane A carve-out inside Lane B's tree, together with the new
`route-map-disclosure.tsx`. BuildPlan §3 updated. Duplicating it per route folder would have meant two
copies of the `computeRoutes` deprecation handling and the WebGL teardown to keep in sync.

### Polling does not remount the map

The bid screen polls `router.refresh()` every 7s. That reconciles rather than remounts, so the map
initialises once — **verified by stamping the `<canvas>` and its container and confirming both
survived a 9s window spanning a poll, `sameCanvasNode === true`**, with the half-typed ₹ amount intact.
The two things that would break it are a per-render `key` (not passed — coordinates are immutable for a
given auction) and object-identity effect deps (already destructured to primitives). Get either wrong
and it is a new WebGL context every 7 seconds.

### Bug found and fixed: the generated OG card was referenced by nothing

`src/app/opengraph-image.tsx` renders a 1200×630 card and its own comment claimed it "takes precedence
over the entries in `src/lib/design/metadata.ts`". **That is backwards** — an explicit
`openGraph.images` wins and the file convention only fills in when the key is absent. `metadata.ts`
listed `/icons/og-image.jpg` with `twitter:card: "summary"`, so every share rendered a 512×512 square
while the real card sat unreferenced at `/opengraph-image`.

Confirmed against the served HTML before the fix — `og:image` pointed at the .jpg with
`og:image:width 512` — and after: `og:image` is `/opengraph-image`, 1200×630, `summary_large_image`,
with the generated alt text. The misleading comment was corrected in place so it cannot cause a
regression twice.

**NOT VERIFIED (carrier map):** (1) the null-coordinate branch — `mappable` is typechecked and the guard
is trivial, but no row with a null coordinate was rendered, so the "disclosure absent, distance string
still present" case is reasoned, not seen; (2) 375×667 only, never a true 390×844, and never with an
on-screen keyboard open beneath an expanded map; (3) collapse-then-reopen bills a second
`computeRoutes` — accepted trade-off, but nothing bounds a carrier toggling it repeatedly;
(4) the OG card was verified as *tags in the served HTML*, not against a real scraper (Slack, WhatsApp,
X), and `og:url` resolves to localhost until `NEXT_PUBLIC_SITE_URL` is set in the deployed environment.

## `PUBLIC_SITE_URL` wired through Secret Manager (user directive)

`NEXT_PUBLIC_SITE_URL` now comes from a Secret Manager secret named **`PUBLIC_SITE_URL`**, added to
`availableSecrets`, the build step's `secretEnv`, a `--build-arg`, and matching `ARG`/`ENV` lines in
the Dockerfile. `docs/gcp-setup.md` and `docs/deploy.md` updated.

**It has to be a build arg, not `--set-secrets`.** `NEXT_PUBLIC_*` is inlined by the compiler during
`next build`; a value mounted at container start arrives after the bundle has already frozen the
`http://localhost:3000` fallback. This is the one case where "put it in Secret Manager" and "mount it
at runtime" are not the same decision.

It is also **not actually a secret** — it is the app's own public origin. It lives in Secret Manager
so every deploy-time value is configured in one place, and that reasoning is written into
`cloudbuild.yaml` so nobody later concludes it was misclassified.

### A dev-only symptom that looks exactly like a bug

With the value set locally, `og:url` picked it up immediately but `og:image` and `twitter:image` stayed
`http://localhost:3000/opengraph-image`. It survived a clean dev restart, and it did **not** follow
`Host` or `X-Forwarded-Host`, so it was not a cache artifact or a proxy-header issue.

**It is dev-only.** Verified against a real production build (`npm run build` + `npm run start`) with
the variable set: both resolve to `https://truckinggo.example.com/opengraph-image`. `next dev` freezes
the file-convention image origin at localhost regardless of `metadataBase`. Worth knowing before
someone spends an afternoon on it — **this cannot be verified in dev at all**, only in a production
build.

**NOT VERIFIED (`PUBLIC_SITE_URL`):** (1) no Cloud Build run — the yaml parses and the wiring is
symmetric across `cloudbuild.yaml`/`Dockerfile`, but `--build-arg` reaching `next build` through the
real pipeline is unproven; (2) the secret does not exist in the project yet, and Cloud Build **fails
the whole build** on a missing `availableSecrets` entry rather than skipping it, so
`gcloud secrets create PUBLIC_SITE_URL` must happen before the next deploy; (3) the Cloud Build
service account needs `roles/secretmanager.secretAccessor` on the new secret like the others;
(4) verified with a placeholder origin, not the real Cloud Run URL.

## Feature: contact exchange + mutual ratings — Lane A is now FRONTEND

New user directive, this session. The lane boundary is **re-drawn horizontally** for this feature:
**Lane A = frontend (`src/app/**`, `src/components/**`), Lane B = backend + migration
(`prisma/**`, `src/lib/**`)**. The board, contracts and step tables are in
[`docs/feature-contact-ratings.md`](./feature-contact-ratings.md) — read that, not this section, to work
the feature. This entry only records what Lane A shipped and what it could not check.

Scope: both roles store contact details (mobile + address; carrier also truck number + type; shipper also
company name), revealed to the counterparty **only once a bid is accepted**; plus mutual 1–5 star ratings,
one per completed job, with the **carrier's rating visible to the shipper while deciding** — on every bid
row and inside the accept-bid sheet.

### Shipped

| Step | Commit | What |
|---|---|---|
| `A0` | `ee914b8` | The feature board + the contracts Lane A codes against |
| `A1` | `7894189` | `rating-stars.tsx`, `star-rating-input.tsx`, `carrier-reputation.tsx` |
| — | `b574ce1` | `sheet.tsx` scroll-lock fix, pulled forward out of `A4` |

### Three decisions worth keeping

**`RatingStars` renders no stars at all when nobody has rated.** Five grey stars read as a zero-star
rating, which is a claim about a carrier we have no basis for — "unrated" and "rated badly" are different
facts, and a new carrier should not look like a bad one.

**`StarRatingInput` is built on native `<input type="radio">`**, not `role="radio"` buttons and a roving
tabindex. Arrow-key navigation and the screen-reader announcement come free, and an `sr-only` input under
a 48px `<label>` is what makes each target a square rather than a 16px glyph.

**All three components are prop-driven and import nothing from `src/lib/`.** They are rendered inside the
accept-bid sheet, which is `"use client"` — a presentational component that reaches into a server read
model cannot be. The side effect is that `A1` had no real gate and was taken before `B2` landed.
Consequence for Lane B, recorded on the board: **`starBreakdown` moved out of the planned `reviews.ts`**
into `rating-stars.tsx`. Rounding to half-stars is presentation; `4.8` is the fact.

### The `add -A` hazard is real, and it fired

Both lanes are in **one checkout**, `D:\Truck-booking`. While staging `A1`, `git status` showed
`prisma/schema.prisma` modified — Claude 2 mid-`B1`. `git add -A` would have committed their half-written
migration inside my component commit. Explicit paths every time; there is no version of this that is safe
to shortcut.

Related: `git pull --rebase` **fails outright** while the other lane has unstaged work
(`cannot pull with rebase: You have unstaged changes`). Do **not** `git stash` to get past it — that
pockets their work. Push first, reconcile after; or wait for their commit.

**NOT VERIFIED (A0/A1 + sheet fix):** nothing rendered. `typecheck` and `lint` are green and there is no
test for any of it yet.
Most likely to be wrong, in order:
1. **The half-star boundaries in `starBreakdown`.** Reasoned, not tested — 4.2 should be four stars and
   4.3 should be four-and-a-half. If a rating looks rounded the wrong way, it is the `- 0.25` / `- 0.75`
   pair. A unit test belongs in `A3`, where the first real average renders.
2. **`star_half` may not be a Material Symbols ligature in the loaded font subset.** If half-stars render
   as the literal text `star_half`, that is the cause — fall back to `star` at reduced opacity.
3. **`peer-focus-visible:` on a sibling of an `sr-only` input.** The focus ring is the only keyboard
   affordance the star picker has; if it does not appear, the picker is invisibly focusable.
4. **The sheet scroll-lock fix is reasoned, not observed.** `documentElement` is the correct element —
   that much is settled by the `globals.css` root-cause work — but "the page behind an open sheet does
   not move on a finger drag" has not been seen. It belongs to the `A6` device sweep.
5. `tabular-nums` and `text-[16px]`-style sizes on the star glyphs are unverified at 390×844; the star
   row could wrap on a narrow bid card.

### Shipped (continued) — `A2` through `A5` complete

| Step | Commit | What |
|---|---|---|
| `A2` | `18a9add` | Onboarding step 2 — `DetailsForm`, shared with the edit screen |
| `A2b` | `0c8a79d` | `/profile/details` + `loading`, prefilled from Lane B's `getOwnContactDetails` |
| `A4` | `ddad8a4` | `ContactCard`, `ReviewSheet`, wired into both auction detail screens |
| `A3` | `23845a6`, `2cb3bf4` | Carrier rating on bid rows and in the accept sheet; recent reviews fetched on open |
| `A5` | `cb084c5` | "Contact & rate" on assigned/won rows; profile reputation block |
| — | `99f2da7` | **Cross-lane fix: empty `NEXT_PUBLIC_SITE_URL` was 500ing every route** |

`npm run build` ✓ (16 routes) · `typecheck` ✓ · `lint` ✓ · **119 tests** ✓ · Rule 1 grep clean.

### Four things this cost, worth not paying twice

**1. `??` is not `||`, and the blast radius was the whole app.** `metadata.ts` had
`process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"`, and `.env.local` carries `=""`. `??` falls
back only on null/undefined, so `new URL("")` threw — at module scope in the **root layout's** import
graph, which turned one unset-looking variable into a 500 on `/login`, `/`, and everything else. It had
been sitting there; nothing in this feature caused it. Found by curling the app for the first time.

**2. A long-running `next dev` keeps a stale Prisma client across a migration.** After `B1`,
`/onboarding/details` failed with `Unknown field 'detailsCompletedAt'` while `typecheck` passed and the
on-disk client had 45 references to it. Both true: `postinstall` regenerates the client on disk, the
running server does not reload it. **Green typecheck + runtime "Unknown field" = restart the dev server.**
I re-read my own code twice before checking that.

**3. A 200 is not a render.** `/profile/details` returned 200 with the right `<h1>` and no form —
`loading.tsx` streams its shell before the body resolves, so the negative check "no phone number on this
page" would have passed against a page that never rendered. Every negative assertion here is now paired
with a positive one on the same fetch (`40 text nodes of real content`, *then* zero `tel:` links).

**4. Explicit `git add` paths do not protect a file both lanes edit.** They stop you staging the *other*
lane's files — that worked, `prisma/schema.prisma` stayed out of my commit twice. But the shared board is
one file, and Claude 2's `git add docs/feature-contact-ratings.md` swept up my uncommitted edits into
their commit. Harmless here; worth knowing before something less harmless.

### `A6` ran — the worklist below is now mostly closed

Driven in headless Chrome over CDP at 390×844 (`217198d`). Full table in
[`docs/feature-contact-ratings.md` §4d](./feature-contact-ratings.md). Headlines:

- **Found and fixed a tap-target bug in every form in the app** — `Input`'s inner `<input>` was 24px
  inside a 48px wrapper, leaving a 12px dead strip top and bottom. `elementFromPoint` proved it.
- **`submitReview` and `acceptBid` both run end to end**, including the `ratingSum`/`ratingCount`
  increment. Those were Lane B's two flagged unknowns.
- **The `sheet.tsx` scroll-lock fix is now behavioural, not reasoned**: `scrollBy(0,400)` behind an open
  sheet moves the page 0px.
- Star picker, focus ring, reduced motion, carrier onboarding branch, 0px horizontal overflow on 9 routes.

Still open: the `P2002` duplicate-review path (unreachable through the UI by design), and anything needing
a *real* device — touch scrolling, iOS rubber-band, the on-screen keyboard.

**Two operational lessons worth more than the code:** `npx next build` while `next dev` is running
corrupts `.next` until you delete it (every route 404s, `/login` included) — stop dev first. And three
apparent bugs were my own probes: `innerText` includes `sr-only` text and applies CSS `uppercase`, and a
dev-mode `router.refresh()` takes longer than 3.5s.

### NOT VERIFIED — the original `A6` worklist (superseded above)

Everything above is `curl` against the dev server. **Nothing has been seen at 390×844, and no control has
been operated.** In rough order of how likely it is to be wrong:

1. **No form has ever been submitted.** `updateContactDetails` and `submitReview` are real (Lane B `B4`)
   and typecheck, but neither has run. Specifically unproven: the `P2002` "already rated" path, and
   `router.refresh()` swapping the rate button for the done state.
2. **The accept sheet has never been opened**, so `RatingStars size="md"` beside the price, the
   zero-rating warning copy, and the fetch-on-open comment list are unrendered. `Sheet` returns `null`
   while closed, so none of it reaches the SSR HTML.
3. **`StarRatingInput` has never been tapped.** The `peer-focus-visible:` ring on a sibling of an
   `sr-only` input is the specific unknown, and it is the picker's only keyboard affordance.
4. **`star_half` may not exist in the loaded Material Symbols subset** — half-stars would render as the
   literal text `star_half`. Every average seen so far (5.0, 4.0) rounds to whole stars, so the half
   branch has genuinely never drawn.
5. The `sheet.tsx` scroll-lock fix — correct element, unobserved behaviour.
6. `/onboarding/details` **CARRIER branch** (truck number + truck-type `ChipRow`) — the dev server reads
   `DEV_BYPASS_ROLE` at startup and I would not restart another lane's process a third time.
7. My Bids "Contact & rate" hint, and "hint absent on an expired row" — both one-line ternaries, neither
   observed against a matching fixture.

## Blockers log
_`<timestamp> — waiting on <gate>; re-checking in 60s`_

- 2026-08-09 — `A2`/`A3`/`A4` all waiting on Lane B's `B2` contracts commit. `B1` (schema + migration) is
  `[x]` on Neon. Nothing ungated remains in Lane A.

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

---

## Carrier feed: per-viewer "Bid placed" / "New" status chip (user directive)

Ad-hoc task, not a BuildPlan step. On `/carrier` (Find Loads), each load card now leads with a chip
saying whether **this** carrier has already bid on it.

**Files.** `src/components/auction-card.tsx` (new `hasBid` field on `AuctionCardData`, new
`BidStateBadge`, rendered only by the `carrier` variant), `src/app/(dashboard)/carrier/page.tsx`
(the lookup), `src/app/(dashboard)/carrier/loading.tsx` (skeleton `lines` 5 → 6, so the placeholder
still matches the card's real height).

**Mobbin references** (CLAUDE.md §8 — this screen is Stitch-designed, so these informed the *addition*
only, not the card): [eBay "Bids & offers"](https://mobbin.com/screens/1ca43fc0-557a-4ab5-a55f-58e59eb386a5)
and [Opendoor Offers](https://mobbin.com/screens/d1e0618e-1037-4b05-b60e-a2c604c7a683) both lead the row
with the viewer's own relationship to the listing (`OFFER RECEIVED`, `ACTIVE`) above the title and price;
[Airtasker Browse tasks](https://mobbin.com/screens/e6fb2c68-dfbf-4c2a-837a-4407038d867c) and
[Redfin Feed](https://mobbin.com/screens/97e5e553-ccc1-43e5-8603-b622df6c1d00) put the same signal
top-left. Hence a chip at the head of the card rather than beside the timer, which is already occupied.

**Both states render, never one.** An absent chip is indistinguishable from a chip that failed to render,
and "New" only reads as *new to you* when it occupies the same slot the bidded state occupies on the card
above it. Word first, tone second (§7.7): `success` (green) for **Bid placed**, `neutral` for **New**.
Green rather than the safety orange deliberately — on this screen orange already means "the price to beat"
and "the button you press", and a third meaning would flatten all three.

**`hasBid` cannot be derived from `bidCount`.** It is per-viewer: a load with nine bids may be untouched by
the carrier reading it. It comes from a second query — `bid.findMany({ carrierId, auctionId: { in: … },
distinct: ["auctionId"] })` over just the ids on the page — because the feed's `include` already spends
`_count.bids` on the total and `bids` on the global minimum, and neither can be per-carrier as well without
losing what it is there for. `distinct` is load-bearing: seed `auction1` holds two bids from `carrier1`
(47000 then 43500), which is normal in a reverse auction. Skipped entirely when the page is empty.

Freshness is already handled: `submitBid` calls `revalidatePath("/carrier")` (`src/lib/actions/bid.ts:95`)
and the page is `force-dynamic`, so the chip flips on the next poll without new plumbing.

**Ownership.** `auction-card.tsx` and the carrier feed are Lane B's (BuildPlan.md §3). Edited by Lane A on
the same basis as the `globals.css` scroll fix above: Lane B is code-complete (`docs/progress-B.md`, all
steps `[x]`), so there is no concurrent writer, and the user asked for this directly.

**VERIFIED:** `npm run typecheck` and `npm run lint` both clean.

**NOT VERIFIED:** no 390×844 pass, and no `build`/`test`. A `next dev` server was already running on
:3000 from this directory, so a second instance with `DEV_BYPASS_ROLE=CARRIER` was refused, and the
running one is seeded `SHIPPER` — `/carrier` just redirects. To see it:
stop the running server, then `DEV_BYPASS_ROLE=CARRIER npm run dev`; seeded `carrier1@demo.test` has bids
on auctions 1, 4 and 5 and none on 2 and 3, so both chip states appear in one screenshot.

Most likely to be wrong, in order:
1. **Chip metrics.** `Badge` is `h-6` with `px-stack-sm`; the icon is forced to `text-[14px]` against the
   Material Symbols default of 24px. If the chip looks tall, lopsided, or the glyph is clipped, that
   override is the cause — `MetaPill` in the same file uses the identical trick and is the thing to
   compare against.
2. **`radio_button_unchecked`** for the New state. It is not in §4.5's icon inventory (the font is loaded
   whole, not subsetted, so it will render) and it may read as a disabled checkbox rather than
   "untouched". A bare dot, or dropping the icon on the New state only, are the two fallbacks.
3. **Vertical rhythm.** The chip is a new first child of a `flex flex-col gap-stack-sm` card, so every card
   grew ~32px and fewer fit above the fold. `loading.tsx` was bumped to match; if the skeleton still jumps
   on hydration, that 5 → 6 was the wrong size.
