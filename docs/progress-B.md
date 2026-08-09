# Lane B Progress — design system, shared components, Carrier vertical

Owned by **Claude 2**. Step definitions: [`../BuildPlan.md` §6](../BuildPlan.md).

Status markers — **`[~]` goes in before the work starts and is pushed on its own** (BuildPlan §1 step 4):
`[ ]` not started · `[~]` in progress right now · `[x]` done + pushed · `[!]` blocked on a gate

> **Lane identity.** The user assigned this session Claude 2 / Lane B directly (CLAUDE.md §0).
> `docs/LANE.md` in this checkout reads `LANE: A` — **both instances are running in the same working
> directory**, and Lane A owns that file, so it is left alone. If this session is resumed after a
> compaction, trust this line, not `LANE.md`.

| Step | Status | Title | Gate | Commit | Notes |
|------|--------|-------|------|--------|-------|
| B0 | `[x]` | Design tokens, global styles, PWA shell | `package.json` | `7690c9e` | B1 gate is OPEN (`@theme` present) |
| B1 | `[x]` | UI primitives | `@theme` in `globals.css` | `c9e599d` | **A4's gate is OPEN** — `ui/button.tsx` exists |
| B2 | `[x]` | Shared components | B1 | | **A3 + A5 gates are OPEN** — `auction-card` · `mobile-nav` · `timer` · `bid-card` |
| B3 | `[x]` | Carrier load feed | `session.ts` + `schema.prisma` | | Stitch `36d28947…` · filters in the URL |
| B4 | `[x]` | Place a bid | `schemas.ts` | | Stitch `69e048b5…` + `16fc1711…` · all six §5.3 guards |
| B5 | `[x]` | My Bids | B4 | | hand-built · Mobbin-referenced · **B6 gate is OPEN** |
| B6 | `[x]` | Profile, state coverage, a11y pass | B5 | | **Lane B complete** · audit findings below |

## B0 notes

**Tokens.** All of CLAUDE.md §4.1–§4.3 is in the `@theme { }` block of `src/app/globals.css` — Tailwind v4
is CSS-first, there is no `tailwind.config.ts` (TechnicalDocument.md §2.4). Three things worth knowing
before editing that file:

1. **The block is additive.** It does not reset Tailwind's default scales, because Lane A's `/login` and
   `/onboarding` already use `text-3xl`, `text-2xl`, `text-sm`, `w-16`, `p-3` and `shadow-sm`. Adding
   `--text-*: initial` would break both screens.
2. **Font families live in a second `@theme inline` block.** `next/font` defines `--font-inter` on
   `<body>`; a plain `@theme` substitutes `var(--font-inter)` at `:root`, where it does not exist yet, and
   the resulting dead value inherits down to every element. `inline` emits the reference into the utility
   so it resolves on the element instead. `body { font-family: … }` in the base layer carries the default.
3. **`rounded-full` is left to Tailwind.** Its built-in `calc(infinity * 1px)` is the token table's 9999px;
   declaring `--radius-full` on top of the static utility only invites a duplicate.

Safe-area utilities (`pt-safe` / `pb-safe` / `pl-safe` / `pr-safe` / `mt-safe` / `mb-safe`) are hand-rolled
with `@utility`. **`tailwindcss-safe-area` is not installed and is not needed** — BuildPlan §3 says A0
pre-installs it, but it is absent from `package.json` and Tailwind v4 handles `env()` natively. No
dependency request follows from this.

**Shell.** `src/components/app-shell.tsx` exports three pieces rather than one component with slots,
because `AppShell` is mounted in the **root** layout and so also wraps `/login` and `/onboarding` — full
-bleed auth screens that render their own `<main>` and must not grow chrome. See `HANDOFF TO A` for the API
Lane A's `A3` needs.

**Icons.** The Stitch logo screen `70b66552da1549d8a24ee67735b7e067` has no `htmlCode`, only a 512×512
raster, and it is a **wide horizontal wordmark on a light background** — illegible below ~96px and cropped
to nothing by a maskable mask. It is therefore used for the OG/social image, where a wide lockup is exactly
right, and the app icons are generated from the login screen's `TruckMark` geometry instead: full-bleed
`primary-container` with the white truck, at 192/512/maskable-512/apple-180, plus a 16+32+48 `favicon.ico`.

`package.json` carries no image library and Lane B may not add one, so the PNGs and the ICO are rasterised
by a throwaway zero-dependency script (`node:zlib` + a hand-rolled CRC32 and ICO container). The **output is
committed; the script is not** — it is a one-shot, and keeping it would imply a build step that does not
exist. To regenerate, the geometry is 100×100 design space, documented in this entry.

**Deviation from BuildPlan `B1` — Shadcn is not used.** `shadcn init` writes `components.json` and pulls in
`clsx`, `tailwind-merge`, `class-variance-authority` and `@radix-ui/*` — all edits to `package.json`, **a
Lane A file**. Routing four dependencies through `DEPS REQUESTED` to buy components that would then need
their `--primary`/`--destructive` naming, slate palette and centred-dialog defaults stripped and rebuilt
against the M3 tokens is a bad trade, and retheming reliably leaves stray slate behind, which B0's
no-raw-hex rule forbids. B1 hand-writes the nine primitives against the tokens, with no new dependencies.
Recorded in TechnicalDocument.md §6.1.

**Doc correction (TechnicalDocument.md §6.1, Lane B's section).** It described tokens as living in
`tailwind.config.ts` under `theme.extend` with a `darkMode: 'class'` key. Neither exists in Tailwind v4;
§6.1 now describes the `@theme` block and the `@custom-variant dark` equivalent, matching §2.4.

`npm run db:seed` was **not** run; per BuildPlan §3 seeding is Lane A's alone, and `B0` touches no data.

## B1 notes

Nine primitives per TechnicalDocument.md §6.2, plus three that earned their place:
`Icon` (every other primitive needs a Material Symbols glyph, and `EmptyState` takes one as a prop),
`ErrorState` (the `error.tsx` counterpart to `EmptyState` — §7.5 requires both), and `CardMetaStrip`
(the §4.4 inset strip, used by both `AuctionCard` variants in B2). Supporting helper: `src/lib/design/cn.ts`.

**No Shadcn, no new dependencies** — the decision and its reasoning are in TechnicalDocument.md §6.1.
`cn.ts` is a five-line class joiner, not `clsx` + `tailwind-merge`: nothing here emits two classes from the
same Tailwind group, because each variant map picks exactly one value per property, so there is no conflict
left to merge. The cost is that a caller's `className` cannot reliably override a variant — Tailwind
resolves conflicts by CSS source order, not attribute order. Add a variant instead of fighting it.

**`"use client"` on exactly two files**, per CLAUDE.md §3.2's list: `chip.tsx` (filter chips own selection
state) and `input.tsx` (`useId`, and every screen using it is a form). `sheet.tsx` is a third — it needs
`useEffect` for Escape, scroll-lock and focus. Everything else is directive-free, so it works in a Server
Component and gets pulled into the client bundle only where a client parent imports it.

Decisions worth knowing before building on these:

- **`Sheet` is not a `<dialog>`.** `showModal()` centres the element by UA stylesheet and its `::backdrop`
  sits outside the token system, so both would have to be overridden — more code than implementing the
  four modal behaviours directly. It slides from the bottom and the footer is sticky, because §7.6 puts the
  confirm button in the thumb zone. A centred modal here is a bug, not a variation.
- **`Chip` is `h-touch-target-min`.** 48px chips read chunkier than a desktop filter bar; CLAUDE.md §3.1
  sets the floor for every interactive element and a filter chip is not exempt.
- **`Input` is `text-body-lg` (16px), never `text-body-md`.** Below 16px iOS Safari zooms the viewport on
  focus, and on a `maximum-scale=1` PWA the user is then stuck at the wrong scale.
- **`Avatar` uses a plain `<img>`**, with an inline eslint-disable naming the reason: Firebase photos come
  from `lh3.googleusercontent.com`, and `next/image` would need that host in `images.remotePatterns` in
  `next.config.ts` — a Lane A file. A 40px avatar gains nothing from the optimiser.
- **`animate-sheet-up` was added to `globals.css`'s `@theme`** (B0's file, still Lane B's). Declared as a
  theme animation so the reduced-motion block collapses it with everything else.
- **`tokens.ts` is the one file where raw hex is correct.** It is the typed mirror of the `@theme` block
  that BuildPlan `B0` requires; the no-raw-hex rule is about markup. Grepping for hex will always hit it.

## B2 notes

Seven components per BuildPlan `B2`, built from the Stitch markup rather than the screenshots
(CLAUDE.md §8): `mobile-nav`, `timer`, `auction-card`, `route-row`, `bid-card`, `fab`,
`polling-refresher`. Supporting: `src/lib/design/nav.ts` (+ tests).

**`Timer` does not reimplement the countdown maths.** Lane A's `formatRemaining` in `src/lib/format.ts`
already implements §7.3 exactly — the `02h 14m` / `45m 12s` / `00m 09s` formats, the 30-minute urgency
threshold, clamping an elapsed deadline instead of going negative — and `src/lib/format.test.ts` already
covers **every boundary §8.1 asks for** (above an hour, below an hour, the final minute, the exact
threshold, the exact deadline, elapsed, ISO string). B2's "unit tests for the timer formatter" line item is
therefore **already satisfied upstream**; writing a second copy in Lane B would have been pure duplication.
`timer.tsx` is the ticking and rendering half only.

What B2 *did* need a test for is the nav active-rule, which is new here and fails silently in both
directions — Home lit on every screen, or no tab lit at all. `src/lib/design/nav.ts` holds the model and
`isNavItemActive`; `nav.test.ts` covers root-exact vs prefix matching, segment boundaries
(`/carrier/bidsomething` must not match `/carrier/bids`), and a sweep asserting at most one tab lights for
every reachable route. It lives under `src/lib/design/` because `mobile-nav.tsx` imports
`next/navigation` and cannot load in vitest's node environment — and because `src/lib/` proper is Lane A's.

**Two cards, not one.** `AuctionCard`'s `variant` is a real fork, because the Stitch screens ask different
questions. Shipper = "how is my auction doing" (LIVE badge, countdown, horizontal route, bid count).
Carrier = "should I bid on this" (price in `display-price`, expiry chip, vertical route with times, meta
pills, View & Bid). `RouteRow` gained an `orientation` prop to serve both.

### Deliberate departures from the Stitch markup

Each is a rule in CLAUDE.md that outranks the mockup; §8 says the markup wins on *tokens*, not on the
hard rules.

| Mockup | Shipped | Why |
|---|---|---|
| `bg-[#ff6b00]` on View & Bid | `bg-primary-container` | Raw hex is forbidden (§3.3); it is the same colour |
| `border: 1px solid #E2E8F0` in the card CSS | `border-surface-variant` | That hex is PRD §6 slate, explicitly superseded |
| `$1,450` · `42,000 lbs` · `15 mi` | `₹` · Tons · km | The app is INR/metric (§6); the mockup's `$` is known drift |
| "Est. Payout" | "Current Price" | It is a reverse auction — that number is the price to beat, not an estimate |
| Filter chips `h-[40px]` | `h-touch-target-min` (48px) | §3.1's floor applies to every interactive element |
| Timer `12m : 45s` | `12m 45s` | §7.3 fixes the format, and it is what Lane A's tested formatter emits |
| `hover:bg-*` on nav and buttons | `active:` only | Hover does not exist on a phone (§3.1) |
| Card shadow `rgba(0,57,115,.08)` | `rgba(0,33,83,.08)` | §4.4's recipe is canonical; the two screens disagree with each other |

Also: the carrier feed's selected chip is `bg-primary`, but TechnicalDocument §6.2 specifies
`bg-primary-container` for a selected `Chip`, and B1 already shipped it that way. Kept `primary-container`
— it is the explicit component contract, and the two Stitch screens are internally inconsistent here.

## B3 notes

`/carrier` + `loading.tsx` + `error.tsx` + `feed-filters.tsx`, from Stitch `36d28947…`. Query is §5.6's:
`status: ACTIVE` **and** `endTime > now`, ordered by `endTime` ascending so the loads a carrier can still
act on come first.

**Filter state lives in the URL, not in `useState`** — this is the load-bearing decision on this screen.
`PollingRefresher` fires `router.refresh()` every 7s; a filter held in component state would be re-rendered
against a server payload built for the *unfiltered* feed, and the chips and the list would silently drift
apart. `searchParams` is part of the request, so it survives every refresh. `router.replace` rather than
`push`, so twelve keystrokes are not twelve history entries.

**`parseFeedFilter` refuses `?filter=nearby`.** The chip is disabled in the UI, and a hand-typed URL must
not be a way around a filter we have not implemented — unknown and disabled values both fall back to `all`.
Untrusted input, treated as such (CLAUDE.md §3.2).

**Nearby stays dead, and visibly so.** Rendered disabled with a "Soon" badge rather than hidden, because
`distanceKm` is the length of the auction's own route, not the carrier's distance from the pickup — we
store no carrier location at all (§10.4). Repurposing it would show a confident "15 km away" that is simply
false. An absent chip hides the gap; a disabled one is honest about it.

**Route data replaces the mockup's invented "15 mi away"**: `formatRouteSummary` renders "148 km · ~3h 15m",
degrades to "148 km" when only distance resolved, and to "Distance unavailable" when neither did. All six
route fields are nullable, so this is the one place that can produce `undefined km` — and it does not. The
pill always renders, so a carrier can tell "no route data" from "a short trip".

**The search box is real.** It filters pickup, dropoff and material, case-insensitively, debounced 300ms
into the same URL state as the chips.

### Deliberate departures

- **The `tune` filter button is omitted.** The BuildPlan text and the mockup both include it, but every
  filter it could open is already one tap away in the chip row directly beneath it, and no filter sheet was
  ever designed. A second control that duplicates the visible one is worse product than no control, and a
  button that opens a sheet showing the same four chips is worse still. If filters later outgrow the row
  (sort order, weight ranges, date windows), `tune` is where they go — `Sheet` from B1 is ready for it.
- **Two different empty states.** "No loads available right now" is what BuildPlan specifies, but it is a
  lie when the feed is empty *because of a filter* — so a filtered miss gets "No loads match those
  filters" with a one-tap route back to `/carrier`. A dead end here would look like a broken feed.
- Chrome is drawn for real in `loading.tsx` rather than skeletoned: the app bar and nav are identical on
  both sides of the load, so a placeholder would only make them flicker.

## B4 notes

`/carrier/auction/[id]` + `loading` + `error` + `bid-form` + `bid-success`, and `src/lib/actions/bid.ts`.
Stitch `69e048b5…` and `16fc1711…`.

**All six §5.3 guards are server-side, and the client duplicates none of them for safety** — only for speed
of feedback. Guard 4 (`endTime > now`) is the one that matters most: the status column lags by up to 60s
until cron sweeps it, so re-checking the deadline on write is what makes that lag harmless. Guard 6 is
"undercut **your own** previous bid", not the global minimum — another carrier being cheaper is the auction
working, not a reason to refuse.

**The confirm step is a bottom `Sheet`, and the write happens after it** (§7.6). Success replaces the form
in place rather than firing a toast: §7.6 says a screen that commits something irreversible shows a success
*screen*. Rendering it in component state rather than routing to `?submitted=` keeps a completed write off
the URL, where a refresh or a shared link could imply it happened again.

A server rejection closes the sheet before showing its message, so the error lands against the form it
belongs to rather than behind a dismissed overlay.

### Deliberate departures

| Mockup | Shipped | Why |
|---|---|---|
| Submit button `bg-[#0A192F]` | `bg-primary-container` | Raw hex, and that navy is superseded PRD palette |
| Success SVG's three PRD hexes | `currentColor` + `text-tertiary` | Same rule; the confetti existed only to carry those colours, so it is gone |
| "Hot Load" badge | "Open for bids" / "Closed" | The mockup's label is unearned — nothing computes heat. This says something true and doubles as the closed state |
| `42,000 lbs` · `920 mi` | `formatWeight` · `formatRouteSummary` | INR/metric (§6), and the route line is required content here (§10.4) |
| Timer `02:14:59` | §7.3 format | Lane A's tested formatter is the one source |
| `#LD-8492` load ID on success | dropped | We have no such identifier; a UUID would be noise |

**`error.tsx` never says the bid failed.** It catches render-time failures on the page; `submitBid`'s
rejections come back through `ActionResult` as inline messages and never reach the boundary. Telling
someone their bid failed when it may have been written would be worse than saying nothing.

## B5 notes

`/carrier/bids` + `loading` + `error` + `bid-tabs`, plus `src/lib/design/bids.ts` (+ 11 tests).
No Stitch screen exists for this one, so per CLAUDE.md §4.6 it was composed from B1/B2 primitives, with
Mobbin consulted for shape only:
[eBay "Bids & offers"](https://mobbin.com/screens/1ca43fc0-557a-4ab5-a55f-58e59eb386a5) (status pill +
amount + time-remaining per row — closest to this screen),
[Whatnot "Activity"](https://mobbin.com/screens/111c4243-d56b-4f7c-8dae-762cc224e56f),
[Vinted "My orders"](https://mobbin.com/screens/1f15685f-4f53-4e26-8aa4-591f2dba803d) (per-tab empty
states). Reference, not source of truth — the tokens win, and no new visual language was imported.

**The status logic is the substance of this step, so it is pure and tested.** Four situations, and the
fourth is the one that is easy to get wrong: a **PENDING bid on an expired auction**. Cron sets
`CLOSED_EXPIRED` and deliberately leaves its bids `PENDING` — nobody won (§5.5). So the bid is still
`PENDING`, still belongs under the Pending tab, but labelling it "Pending" would promise an outcome that
can never arrive. It reads **"Auction expired"** instead.

`resolveBidStatus` checks `endTime` directly rather than trusting `auction.status`, for the same reason
`submitBid`'s guard 4 does: cron lags up to 60s, so a row can read `ACTIVE` after its deadline. A test pins
that case specifically, and another asserts the four situations are distinguishable **by text alone** —
which is §7.7's no-colour-alone rule turned into something that can fail.

**Tabs are `Chip`s, not a new segmented control.** The Mobbin references use underline tabs for status and
pills for sub-filters, but that two-level hierarchy exists because those screens have two levels. This one
has one, so a second control language would be invention for its own sake. Selection lives in
`searchParams` so it survives a refresh and a tab is linkable.

Counts for all three tabs come from the single per-carrier query rather than three round trips.

**Every bid is listed, not one row per auction.** §5.6 specifies `where: { carrierId }` with no
de-duplication, and in a reverse auction a carrier's own successive bids are real history — the screen is
"My Bids", not "My Auctions". Worth revisiting if a carrier who bids ten times finds the list noisy.

`error.tsx` is beyond `B5`'s file list (which names only `page` and `loading`), but §7.5 requires an error
state on every list screen, and without one a failure falls through to the root boundary and loses the nav.

## B6 notes — profile, state coverage, a11y

`/profile` + `loading` + `error` + `sign-out-button`, the offline banner, three app-wide boundaries, and
the audit. **This completes Lane B (B0–B6).**

**Profile is deliberately thin.** There is nothing to configure: the role is immutable once chosen
(`setUserRole` refuses a second write), so a "change role" control would be a dead end, and inventing
preferences nothing reads would be worse than a short screen. It uses `requireSession`, not `requireRole`
— it is the one `(dashboard)` screen either role reaches — and redirects a role-less user to `/onboarding`.
Sign-out confirms in a bottom `Sheet`: not destructive, but one tap from the nav, and an accidental
sign-out costs a whole Google round trip.

`profile/loading.tsx` and `profile/error.tsx` render **without** `MobileNav`, unlike the other screens'.
The nav needs a role, and the role is precisely what those states are still waiting on — drawing one would
light the wrong three tabs.

### State coverage — the real gap was app-wide, not per-screen

Every route now has a boundary, and nothing falls through to Next's default error page (the raw stack
§7.5 forbids). Before this step there were **no root boundaries at all**:

| Added | Catches |
|---|---|
| `src/app/error.tsx` | `/`, `/login`, `/onboarding`, `/shipper/*` — every route without its own |
| `src/app/not-found.tsx` | bad URLs, and `notFound()` from a detail page whose id no longer resolves |
| `src/app/global-error.tsx` | a failure in the **root layout itself**, which `error.tsx` cannot catch |

`global-error.tsx` uses **inline styles and hard-coded colours**, which is correct exactly once: it
replaces the whole document, so if the failure was `globals.css` never loading, every token class would
render as nothing and the user would get invisible text. Recorded in TechnicalDocument.md §7.7 alongside
the other sanctioned exception.

The **offline banner** is mounted in `AppShell`, so it covers both lanes without either remembering it.
It starts optimistic and corrects in an effect — `navigator` does not exist during SSR, and a banner that
flashes on every cold load is worse than one a tick late. It matters *because* there is no service worker
(§7.2): nothing degrades gracefully on the user's behalf, so the app has to say so.

### Accessibility audit

- **No colour-alone** is enforced by a test, not by review: `resolveBidStatus` has one asserting the four
  bid situations are distinguishable **by text**. Every `Badge` takes its word as children rather than
  deriving it from `tone`.
- **Icon-only controls** all carry an `aria-label` — audited across both lanes, 22 in total. The `Icon`
  primitive makes the right thing the default: `aria-hidden` unless given a `label`, so an icon inside an
  already-labelled control is silent, and an icon-only button must name itself.
- **`prefers-reduced-motion`** is handled once in `globals.css` and therefore already covers everything
  added since: `animate-ping`, `animate-pulse`, `animate-sheet-up`, the success tick's stroke draw, and
  every `active:scale-*`.
- **Contrast** rides on the `on-*` pairings. Tightest currently shipping is `text-secondary` on
  `surface-container-low`; worth a contrast-checker reading during `V9`.

### Accept-criteria greps — all clear

`grep -rnE '\b(sm|md|lg|xl|2xl):'` · PRD palette · `GOOGLE_MAPS_SERVER_API_KEY` in `src/app`/`src/components`
— all empty across the whole tree, both lanes.

Two hex findings that are **not** violations, both now documented in TechnicalDocument.md §7.7:
the Google `G` mark in `(auth)/login/google-button.tsx` (Google's branding terms require those exact four
colours — tokenising them would be a licensing problem, not an improvement), and `global-error.tsx` above.
`src/generated/prisma/**` also matches the `any` grep; it is gitignored generated code.

## B0 fix — favicon.ico RGBA (`ecf29fb` handoff from Lane A)

Lane A's Cloud Build died in `next build` on `src/app/favicon.ico`:
*"Format error decoding Ico: The PNG is not in RGBA format!"* Their diagnosis was exact — B0's hand-rolled
rasteriser emitted **colour type 2 (RGB)**, and Turbopack's ICO decoder accepts only **colour type 6
(RGBA)**.

Fixed at the encoder: it now writes 4 channels with a constant `0xFF` alpha. Applied to the standalone
PNGs as well, not just the ICO entries — they decoded fine as RGB, but keeping two encodings in one
rasteriser is how the next one of these happens. The mark is fully opaque so nothing changes visually, and
zlib compresses the constant alpha channel to near nothing (favicon 825 → 867 bytes).

Verified: all ten shipped PNGs — the four standalone icons and all three entries inside each of the two
`.ico` files — now report `bitDepth=8 colorType=6`.

**Not** verified by a clean `next build` in this checkout: `rm -rf .next` fails against Lane A's running
dev server (`.next/dev/lock`, permission denied), and Lane A noted the failure only reproduces on a clean
build. The fix is precisely what the diagnosis called for and is confirmed at the byte level; Cloud Build
is the confirmation that counts.

Worth recording as a process point: B0's local pass missed this because the ICO is only decoded during a
**clean** build. `V4` in BuildPlan §7.2 should be run against a cleared `.next`, not an incremental one.

## VERIFICATION STATUS
_Verification is deferred to BuildPlan §7 (CLAUDE.md §10). Where the toolchain happened to be usable,
§10.3 says to run it — so some of this is now green rather than unknown._

**Ran clean over B0 – B6** (all of Lane B):

- `npm run typecheck` — **passes** (found and fixed one real defect: `NAV_ITEMS[role][0]` is
  `NavItem | undefined` under `noUncheckedIndexedAccess`)
- `npm run lint` — **passes**, exit 0
- `npm run test` — **54 passed**, 5 files (B2's 7 nav + B3's 16 feed + B5's 11 bid-status, alongside
  Lane A's formatter and maps tests)
- discipline greps — no breakpoint variants, no raw hex outside `tokens.ts`, no `any`

**`npm run build` passes on `main`** — confirmed by Lane A after the favicon fix (`f82856f`), against a
clean `.next`. That retires the largest open question from B0: the `@theme` block emits and the app
compiles. It has not been re-run since B3–B5 landed.

Still not done: **nothing has been rendered**. Every remaining item below needs a browser.

## NOT VERIFIED
_What is still outstanding for BuildPlan §7.2 — see CLAUDE.md §10.2._

**Nothing in B0–B2 has been rendered.** Typecheck, lint and tests pass, but every one of these is a
*runtime* or *visual* property that no static check can reach. All of it is CSS emission or layout, which
is why `V4`–`V7` exist.

**Whether the tokens actually emit** — the entire premise of B0. `typecheck` says nothing about whether
Tailwind produced a `bg-primary-container` rule. Fastest possible check: load `/login` (Lane A, already
built against these tokens) and see whether it is styled at all.

1. **The `@theme inline` font block.** If `font-headline-md` renders as a system sans rather than Inter,
   this is the cause — `--font-inter` is defined on `<body>` by `next/font`, and `inline` is what makes the
   reference resolve on the element instead of dying at `:root`.
2. **`pt-safe` / `pb-safe`.** Custom `@utility` names in the same namespace Tailwind's dynamic `pt-*`
   resolves from. Symptom: safe-area padding simply absent under the notch.
3. **`AppScreen`'s nested `calc(env(…))`.** Symptom: first card hidden under the app bar, or last card
   under the bottom nav.
4. **`@keyframes sheet-up` nested inside `@theme`.** If `animate-sheet-up` does nothing, move the
   keyframes to top level; the `--animate-*` token stays as it is.
5. **`z-60` on the `Sheet` overlay.** Relies on v4's bare numeric z-index. Symptom: sheet renders *under*
   the app bar or bottom nav (both `z-50`). Fallback is `z-[60]`.
6. **The dashed route rail** — `bg-[linear-gradient(…var(--color-primary)…)]` with `bg-[length:2px_8px]`
   in `route-row.tsx`. The most fragile arbitrary value in the set. Cosmetic if it fails.
7. **`ChipRow`'s `[scrollbar-width:none]` / `[&::-webkit-scrollbar]:hidden`.** Cosmetic — a visible
   scrollbar, nothing worse.
8. **`src/app/favicon.ico` vs `metadata.icons`.** Next's file convention may take precedence over the
   config-based icon list. The manifest is unaffected, so this is cosmetic.

**Behavioural, needs a browser and a clock:**

9. **`Timer` hydration.** It renders a server-computed label, then re-syncs in `useEffect`;
   `suppressHydrationWarning` covers the one-second window where the two clocks disagree. Watch for a
   value that never starts ticking — that means the effect is not running, not that the format is wrong.
10. **`Timer`'s single `router.refresh()` at zero**, guarded by a ref. A refresh *loop* at expiry is the
    failure to watch for. Seeded auction 3 ends in ~4 minutes, per §8.2.
11. **`PollingRefresher` pausing on a hidden tab.** Verify in the Network panel: no requests while
    backgrounded, one immediately on return.

**B3, needs the feed rendered against seed data:**

12. **Filters surviving a poll.** The whole reason filter state is in the URL. Select "High Weight", wait
    out two 7s refreshes, confirm the chip stays selected and the list stays filtered.
13. **Search debounce vs. `router.refresh()`.** `FeedFilters` keeps a local `draft` and a `dirty` ref to
    tell "the user typed" from "the server sent a new value". A refresh mid-typing must not clobber the
    box. Type slowly across a poll boundary and watch for characters vanishing.
14. **`mode: "insensitive"`** on the three `contains` clauses — Postgres-only in Prisma, and untested here.
    Symptom: searching "mumbai" finds nothing while "Mumbai" works.
15. **Chip row scrolling without the page scrolling** — accept criterion. The `-mx-margin-mobile` bleed
    plus `overflow-x-auto` from `ChipRow`.
16. **Which seed rows appear.** carrier1 should see auctions 1, 2 and 3 (ACTIVE, future `endTime`), and
    *not* 4 (CLOSED_EXPIRED) or 5 (COMPLETED_ASSIGNED). Auction 3 ends ~4 min out, so its timer should
    already be red.

**B4 — the guards need adversarial testing, which is the whole point of them:**

17. **Guard 4 with the UI forced open.** Load the bid screen on seeded auction 3, wait past its ~4-minute
    deadline *without* letting the page refresh, then submit. Must be rejected server-side. This is the
    single most important check in the step — everything else is UX.
18. **Guard 6.** Bid twice: the second must be strictly lower or come back with an inline message naming
    the current bid.
19. **Guard 1 / 5.** A SHIPPER session calling `submitBid` must be refused; `requireRole("CARRIER")` on the
    page only hides the form.
20. **The shipper sees it within ~7s** — the `revalidatePath` set crossing to Lane A's A5 screen.
21. **CTA reachable with the numeric keypad open at 390×844** — accept criterion, and the reason the footer
    is sticky. Worth checking on a real iOS device rather than DevTools, which fakes keyboard inset.
22. **`animate-[draw-mark_…]`** on the success tick — an arbitrary animation name plus a `@keyframes` in
    `@theme`. If the tick appears fully drawn with no animation, that pairing is why. Cosmetic.

**B6 — the audit itself is done; what it could not check needs a browser:**

26. **The offline banner.** DevTools → Network → Offline. Should appear within a tick, sit above the app
    bar, and clear on reconnect. The optimistic-start decision means it can never flash on a normal load —
    confirm that too.
27. **`global-error.tsx` actually rendering.** The hardest state to reach deliberately: throw from the root
    layout. Worth doing once, because if it is broken you only find out during a real outage.
28. **`not-found.tsx`** via a junk URL and via a deleted auction id (`notFound()` from the detail page).
29. **Sign-out.** The `Sheet` confirm, then `signOut` revoking tokens and landing on `/login` — and that
    the back button does not restore a signed-in screen from bfcache.
30. **Reduced motion end-to-end.** OS setting on, then check `animate-ping`, the skeleton pulse, the sheet
    slide and the success tick are all still.

**B5 — the status logic is tested, so what is left is the data:**

23. **All four situations visible at once.** The seed gives auction 4 two PENDING bids on a
    `CLOSED_EXPIRED` auction and auction 5 one ACCEPTED + two REJECTED — so between carriers 1–3 every
    state exists. Check that the expired-auction bids read "Auction expired" and **not** "Pending", which
    is the one case a reader would otherwise trust.
24. **Counts on the chips match Prisma Studio** — accept criterion.
25. **Tab selection surviving a refresh**, and `?tab=won` being linkable.

## DEPS ADDED
_Packages this lane installed. The other lane must re-run `npm install` after pulling._

**None.** B0 added no dependencies and B1 will not either.

## DEPS REQUESTED
_Removals and upgrades only — additions each lane makes itself (BuildPlan §3)._

**Empty.**

## HANDOFF TO A
_Defects found in Lane A files, and requests. Report, do not fix._

### B6 audit — state gaps in Lane A screens (report, not fix)

Audited every route on `main`. Lane B's four are complete. Yours, as they stand:

| Route | loading | error | Note |
|---|---|---|---|
| `/` | — | now covered | Pure redirect; root `error.tsx` catches a `getSession` failure |
| `/login` | — | now covered | Not a list, so §7.5's four states don't strictly apply |
| `/onboarding` | — | now covered | Same |
| `/shipper/create` | **missing** | now covered | Does async work before first paint — a `loading.tsx` would help |
| `/shipper` (A3) | not built | — | When it lands: it **is** a list, so all four states apply |
| `/shipper/auction/[id]` (A5) | not built | — | List of bids — same |
| `/shipper/history` (A7) | not built | — | Same, plus a terminal-status empty state |

**I added `src/app/error.tsx`, `not-found.tsx` and `global-error.tsx`** — app-wide, unowned by either
lane's list, and squarely B6's "state coverage" mandate. They now catch failures on your screens too, which
is why the middle column reads "now covered". If you would rather own them, take them; just don't add a
second set, and note that a route-level `error.tsx` you add will correctly win over the root one.

For A3/A5/A7 the checklist is: `loading.tsx` with `Skeleton` matching the real card geometry, `error.tsx`
with `reset()`, and an `EmptyState` with a CTA. `SkeletonList`, `EmptyState` and `ErrorState` are all in
`src/components/ui/` and take exactly those props.

### ⚠ Lane B edited `cloudbuild.yaml` and `prisma.config.ts` (user instruction)

`cloudbuild.yaml` is yours. The user hit the failure, gave it to Lane B, and then said "take ownership and
fix on your end", so this one is mine. **Do not re-fix it** — that is what happened with the favicon, and
we each spent a step on the same blocker.

Cloud Build got past `npm ci` (your npm 11 pin worked) and died in step 2:

```
npm error code EACCES · npm error syscall mkdir · npm error path /builder/home/.npm
```

**Cause.** The migrate step runs the *runner* image, which ends with `USER nextjs` (uid 1001). Cloud Build
points `HOME` at `/builder/home`, which is root-owned, so npm's first act — creating its cache — is denied.
Nothing to do with Prisma or the database.

**Fix** (`env` on that step only): `HOME=/tmp`, `npm_config_cache=/tmp/.npm`. `/tmp` is the only path
reliably writable by an arbitrary uid inside a step, and nothing persists between steps anyway.

Also changed `npx prisma` → `npx --yes prisma`. The standalone output only traces what the server actually
imports, so the **Prisma CLI is not in the runtime image** even though `@prisma/client` is — `npx` will
therefore fetch it, and without `--yes` it stops at a confirmation prompt that has no TTY to answer it.

**Then it failed again, further along** (`4d309c7`). With npm working, Prisma got as far as loading the
config and died on `Cannot find module 'dotenv'`. Cloud Build runs every step with `cwd=/workspace` — the
repo source, **no `node_modules`** — so both of `prisma.config.ts`'s imports were unresolvable there:

- `dotenv` (a devDependency) is now loaded lazily in a `try`/`catch`. The file's own comment already said
  "in Cloud Build the vars are already in the environment, so this is a no-op there" — the import just had
  to stop being mandatory for that to be true.
- `defineConfig` → **`satisfies PrismaConfig` with a type-only import**. Same type checking, erased at
  compile time, so `prisma/config` never resolves at runtime. This was the *next* failure in line and
  would have cost another deploy to find.

**Reproduced locally this time**: `prisma.config.ts` + `prisma/` copied into an empty directory with no
`node_modules`, then `npx --yes prisma@7.9.1 validate`. Before: `Cannot find module 'prisma/config'`.
After: config loads, schema valid. `npx prisma validate` in the repo still loads `.env.local` unchanged.

**Keep both imports non-runtime.** Tidying that type-only import back into a value import breaks the deploy
in exactly the same way.

**Still unverified**: whether `npx --yes prisma` resolves the CLI itself inside that step — the config is
now proven, the CLI fetch is not, and there is no Docker here to test it. If it fails again, the fallback
is to stop using the runner image for migrations: run them from a plain `node:22-alpine` step that does
`npm ci --ignore-scripts --omit=dev` against `/workspace` first (note `prisma` is a *dependency*, not a
devDependency, so it lands in the tree), which makes `prisma` a local binary instead of an npx fetch.

0. **`A4`'s gate is OPEN** — `src/components/ui/button.tsx` exists as of `B1`. The create-auction form can
   start now; it does not need to wait for `B2`. Available to it: `Button` / `ButtonLink`
   (`variant`, `size="lg"` for the sticky footer, `loading`), `Input` (with `prefix="₹"` /
   `suffix="Tons"`, `error` wired to `ActionResult`'s `field` key), `Textarea`, `Card`, `Chip` + `ChipRow`
   for the duration selector, `Sheet` for the confirm, and `Icon` for any Material Symbol.

1. **Shell API for `A3` / `A4` / `A5`.** `src/components/app-shell.tsx` now exports three things.
   `AppShell` stays in the root layout untouched; dashboard screens compose the other two themselves,
   because neither lane owns a `(dashboard)/layout.tsx`:

   ```tsx
   import { AppScreen, TopAppBar } from "@/components/app-shell";
   import { MobileNav } from "@/components/mobile-nav"; // B2

   <>
     <TopAppBar leading={<Avatar …/>} title="TruckingGO" trailing={<NotificationsButton />} />
     <AppScreen>{/* cards */}</AppScreen>
     <MobileNav role="SHIPPER" active="home" />
   </>
   ```

   `AppScreen` takes `hasAppBar` / `hasNav` (both default `true`) — pass `hasNav={false}` on
   `/shipper/create`, which ends in a sticky footer button rather than the nav.

2. **Please wire the metadata module into `src/app/layout.tsx`** (your file, so not done here). A new
   Lane-B-owned `src/lib/design/metadata.ts` carries the full document metadata — OG and Twitter cards, the
   icon set, `apple-touch-icon`, `formatDetection`, and the viewport with `themeColor` read from the token
   constants. It supersedes the inline `metadata` / `viewport` exports currently in `layout.tsx`:

   ```ts
   export { siteMetadata as metadata, siteViewport as viewport } from "@/lib/design/metadata";
   ```

   `formatDetection` is the one that matters on device: without `telephone: false`, iOS Safari auto-links
   anything number-shaped, which on a screen of ₹ amounts, kg weights and countdown digits turns arbitrary
   numbers into blue tappable links.

3. **`src/app/favicon.ico` was replaced** — it was still the Next.js scaffold default (the Vercel
   triangle); it is now the TruckingGO mark at 16/32/48, with a copy at `public/icons/favicon.ico`.
   It sits in your tree but no lane owned it, and it is the only path Next 16 actually serves a favicon
   from. **BuildPlan §3 now assigns it (and `icon.*` / `apple-icon.* `/ `opengraph-image.*` under
   `src/app/`) to Lane B** as a carve-out, alongside `LocationAutocomplete.tsx` going the other way.

4. **Optional: `NEXT_PUBLIC_SITE_URL` in `.env.example`.** `metadata.ts` uses it as `metadataBase` so OG
   image URLs resolve absolutely, and falls back to `http://localhost:3000` when unset — so nothing breaks
   without it, but social cards will point at localhost in production until it is set to the Cloud Run URL.
   It is a public, non-secret value; safe as a plain build/runtime env var.

5. **Shared working directory — resolved by your `02cda46`, thank you.** For the record of what it cost:
   `node_modules` was deleted and reinstalled underneath `B0`, and `package-lock.json` is still showing as
   deleted in the tree here. Once Lane B moves to its own checkout this stops mattering; until then, a
   failing command may be your install rather than a real break.

6. **Dependencies no longer route through you.** BuildPlan §3 now lets either lane add a package directly,
   in a deps-only commit pushed immediately, recorded under `DEPS ADDED`. `DEPS REQUESTED` is now only for
   removals and upgrades. Re-run `npm install` after pulling a commit prefixed `deps:`.

## Blockers log
_`<timestamp> — waiting on <gate>; re-checking in 60s`_

- Lane B never idled. Every gate was open when its step came up: `B0` needed only `A0`, `B1`/`B2` were
  own-lane, and `B3`/`B4` were unblocked by `A1` long before they were reached.

## VERIFICATION WORKLIST — Lane B complete (B0–B6)

Per BuildPlan §7.1, this is the worklist §7.2 inherits from this lane. **Lane A still has `A3`, `A5`, `A6`
and `A7` open, so §7.2 must not start yet.**

What is already green across B0–B6: `typecheck`, `lint`, `test` (54, 5 files), and the three
accept-criteria greps. `npm run build` last passed on `main` at the favicon fix; it has not been re-run
since B3–B6 landed.

What remains is **30 numbered items under `NOT VERIFIED`**, none of which a static check can reach. Ranked
by what would hurt most if wrong:

1. **#17 — guard 4 with the UI forced open.** Bid on a load whose deadline has passed without letting the
   page refresh. If this fails, the auction can be won after it closed. Everything else on this list is UX.
2. **#12 / #25 — URL-held filter and tab state surviving a 7s poll.** The single design decision the
   carrier screens rest on.
3. **#23 — a PENDING bid on an expired auction reading "Auction expired", not "Pending".** Tested in
   isolation; unproven against real seed rows.
4. **#1–#3 — whether the tokens emit at all.** Cheapest possible check: load `/login` and see if it is
   styled.
5. Everything else is cosmetic or single-screen.

---

# FEATURE — contact exchange + mutual ratings

> Board: [`feature-contact-ratings.md`](./feature-contact-ratings.md). **The lane split changed for this
> feature** — it is now horizontal: Lane B owns `prisma/**` and `src/lib/**`, Lane A owns `src/app/**` and
> `src/components/**`. The `B1`–`B7` step IDs below are the *feature* board's, and are unrelated to the
> `B1`–`B6` of the original build above.

| Step | Status | Title | Commit | Notes |
|------|--------|-------|--------|-------|
| B1 | `[x]` | Schema + migration | `7a00aa1`+ | migration applied to Neon · **`B2` `B5` `B6` `B7` gates OPEN** |
| B2 | `[x]` | Contracts + typed stubs | | **`A2` `A3` `A4` gates OPEN** · typecheck+lint+74 tests green |
| B3 | `[x]` | Visibility rule | | **`A4` gate OPEN** · 12 new tests, 86 total green |
| B8 | `[x]` | `getOwnContactDetails` (Lane A request) | | **`A2b` gate OPEN** |
| B4 | `[x]` | Actions | | `updateContactDetails` + `submitReview` real |
| B5 | `[ ]` | Session gate | | |
| B6 | `[ ]` | Read model | | |
| B7 | `[ ]` | Seed fixtures | | |

## B1 notes — schema + migration

`20260809051234_add_contact_details_and_reviews`, **created and applied against Neon**. Purely additive:
eight nullable/defaulted columns on `User`, one new `Review` table, no existing column changes meaning, so
every row that predates the feature stays valid and nothing needed backfilling.

Matches the board's §4 contract exactly, with three things worth knowing before building on it:

- **`Review` FKs are `ON DELETE RESTRICT`** (Prisma's default). That breaks `prisma/seed.ts` as it stands:
  it deletes bids → auctions → users, and a `Review` row now blocks all three. `B7` must add
  `prisma.review.deleteMany()` as the *first* delete. Flagging it here because the failure mode is a seed
  that dies halfway with the tables already half-truncated.
- **`stars` carries no DB-level 1–5 check.** Prisma cannot express a `CHECK` constraint in the schema, and
  a hand-written one in the migration would be invisible to the schema file and silently dropped by the
  next `migrate dev`. The bound is enforced twice in code instead — `SubmitReviewSchema` (`B2`) and
  `submitReview` (`B4`) — which is where every other business rule in this codebase lives.
- **`detailsCompletedAt` is a timestamp, not a boolean.** A pre-feature user and a user who filled the form
  today are then distinguishable, which matters for `B5`'s redirect and for any later "please re-confirm
  your details" prompt.

`npm run db:seed` was **not** run — that is `B7`, and it truncates a database Lane A is using.

**NOT VERIFIED (B1):** no typecheck/lint/build yet (the generated client changed shape, so `B2` is the
first step that can meaningfully typecheck). Most likely to be wrong: nothing in the SQL — it applied
cleanly and is additive — but the `Review` relation names (`ReviewsWritten` / `ReviewsReceived`) are the
kind of thing a later `include` gets wrong silently, and the `RESTRICT` seed hazard above is a real,
already-known break waiting for `B7`.

*Retired by `B2`:* `npm run typecheck` and `npm run lint` pass against the regenerated client, so the
relation names and the new columns are confirmed to exist and to be spelled as §4 says.

## B2 notes — contracts, and the four Lane A gates it opens

The unblocking commit. Signatures everywhere Lane A needs them; behaviour only where behaviour was free.
`A2`, `A3` and `A4` can all start now.

### Where each thing actually lives, and why it is not always where §4 said

- **`ratingAverage` / `formatRating` are defined in `format.ts`, re-exported from `reviews.ts`.**
  §4 puts them in `reviews.ts`, but `reviews.ts` has to be `server-only` — it holds the Prisma reads —
  and Lane A's rating components are `"use client"` (they render inside the accept-bid sheet). Defining
  them in the pure formatters module and re-exporting satisfies the written contract from either import
  path, with one implementation. A duplicated copy would have been the alternative, and the half-star
  boundary is exactly the kind of thing that then drifts.
- **`dealWhere` and `canExchangeContact` are real already, not fail-closed stubs.** `getDeal` is the only
  one of the three Lane A ever calls, so stubbing the other two would have changed nothing for them while
  costing a placeholder that then has to be deleted. `getDeal` still returns `null` — the fail-closed
  default — so the intermediate state cannot leak. `B3` is therefore "`getDeal` + the tests that prove all
  three agree", which is the substance of that step anyway.
- **`updateContactDetails` is stubbed in `actions/user.ts`**, which §3's file list for `B2` omits but §4's
  contract requires. `A2` builds its form against that signature.

### Contract additions Lane A must know about

Written into §4 of the board as well, because §4 is where they will look:

- **`TRUCK_TYPES` is a closed list and `truckType` is a `z.enum`.** Free text would make the field
  worthless the first time someone types "cntnr" — a shipper reads it as a fact about the vehicle they
  hired. Six values, extend the array rather than loosening the schema, and the field wants a `ChipRow`.
- **Normalisation happens inside the schema, before validation.** `ContactDetailsSchema` pipes phone
  through `normalizePhone` and truck number through `normalizeTruckNumber`, so `"+91 98765 43210"` and
  `"9876543210"` are one input and the column always holds the canonical form. The form must not
  re-implement `PHONE_RE` / `TRUCK_NUMBER_RE`; it should surface `ActionResult.field`.

### Two decisions inside the schema worth stating

**`stars` has no DB `CHECK`** (see `B1`), so `SubmitReviewSchema` and `submitReview` are the only bound on
1–5. `z.coerce.number()` because the value arrives from a `FormData` star input as a string.

**`ContactDetailsSchema` is discriminated on `role`, but the *client picks the shape, never the identity*.**
`B4` checks the branch against `session.role` and refuses a mismatch. The discriminator is there so the
server never has to guess which set of fields it is looking at — it is not, and must not become, the thing
that decides what the user is.

**NOT VERIFIED (B2):** `typecheck`, `lint` and `test` (74, 7 files) all pass, and the §6 greps are clean —
`phone` / `truckNumber` / `companyName` appear in `src/app` and `src/components` only inside three
unrelated prose comments. No `build`, nothing rendered, and **no test yet covers the new code**: the
formatters and the zod pipeline are untested until `B3`/`B6` add their files. Most likely to be wrong:
`normalizePhone`'s leading-`0` and leading-`91` stripping (an 11-digit number starting `0` and a 12-digit
one starting `91` are the two branches, and a `+910…` input hits neither), and `TRUCK_NUMBER_RE` against
the newer BH-series and older three-letter-district plates, which it will reject.

## B3 notes — the visibility rule

`getDeal` implemented, and `contact.test.ts` added: 12 tests, 86 across the suite. **`A4`'s gate is open.**

**The filtering is the query, not a check on data already fetched.** `getDeal` passes `dealWhere` as the
`where` and selects the sensitive columns inside it, so for anyone the rule excludes the row simply does
not come back — an unauthorised caller never has the phone number in memory at all. Writing it the other
way round (fetch the auction, then decide) would work identically until the day someone adds a log line or
an early return between the two halves.

**Two decisions inside the query:**

- **`role` is not selected**, and `DealParty.role` is derived from position — shipper, or the carrier whose
  bid was accepted. The column is nullable, and the role that matters on a contact card is the one this
  person played in *this deal*, which is a fact about the query's shape rather than about a column that
  could in principle disagree with it. That removes a null case with no sensible answer.
- **`iReviewed` rides the `@@unique([auctionId, authorId])` index** as a bare existence check, in the same
  round trip. Not a second query, and not `count` — the answer is a boolean.

**Both `OR` branches require an `ACCEPTED` bid, the shipper's branch included.** This is the subtle half of
the rule and it has its own test. Without it, a shipper would see contact details on any row whose status
column read `COMPLETED_ASSIGNED` — and a status column can be reached by a partial write or a manual fix,
whereas an accepted bid actually names the counterparty.

**The test interprets `dealWhere`'s returned object** rather than restating the rule a third time — the
same device as `auction-close.test.ts`, for the same reason: the `WHERE` cannot execute in vitest, and a
test that duplicates the rule in prose only proves the duplicate. It reads `where.id`, `where.status` and
each `OR` branch's fields, and **throws** if the shape changes rather than silently passing. The sweep at
the end asserts the negative directly: on every row, a losing carrier and a stranger match nothing.

`vi.mock("@/lib/prisma")` at the top of the test file — `prisma.ts` throws at import time without
`DATABASE_URL` and vitest does not load `.env.local`. Nothing here calls `getDeal`, so the client is
stubbed rather than pointing the unit suite at a live database. **This is the first test in the repo to
import a Prisma-touching module**; the next one will want the same three lines.

**NOT VERIFIED (B3):** `typecheck`, `lint`, `test` (86, 8 files) green. `getDeal` itself has **never been
executed** — the tests cover the rule, not the query, and the query is where the remaining risk is. Most
likely to be wrong, in order: the nested `bids: { where: { status: "ACCEPTED" }, select: { carrier: … } }`
shape under Prisma 7 (a typo here typechecks if the generated types are looser than expected); `iReviewed`
reading `auction.reviews.length` when `reviews` is filtered by `authorId` — if that filter is ever dropped,
it silently becomes "anyone reviewed"; and whether `findFirst` with an `OR` plus two relation `some`
clauses picks up the indexes or table-scans, which is a performance question, not a correctness one.
Cheapest real check: seed data from `B7`, then load a `COMPLETED_ASSIGNED` auction as the shipper, as the
winning carrier, as a losing carrier, and as a stranger.

## B8 notes — `getOwnContactDetails`, taken out of order

Lane A's request in §4 of the board, and a correct one. Own details are not a Rule 1 read — the session
*is* the authorization — so they could have queried it themselves. The argument for not doing so is the
grep: Rule 1 is worth having only while **any** hit for `phone` / `truckNumber` / `companyName` under
`src/app/` is a bug with no reading required. One legitimate exception and every future hit needs a human
to adjudicate, which is the same as not having the check. Fifteen lines on this side keeps it total.

Taken ahead of `B4` because `A2b` was sitting at `[!]` on it and it costs nothing; `B4` was not waiting on
anything.

**One widening of the spec, flagged on the board.** `OwnContactDetails.role` is `Role`, but the column is
nullable, so a role-less user has no representation in that type. Rather than widen the type and make Lane
A handle a case that cannot reach the screen, `null` now also means "no role yet" — those users belong at
`/onboarding`, which `B5`'s guard sends them to. A user who has a role and has simply never filled the
form still returns a record of nulls, which is the empty-form case they asked for.

**NOT VERIFIED (B8):** `typecheck` / `lint` / `test` (86) green; no test of its own and none warranted —
it is a keyed `findUnique` with no rule in it. Never executed. Most likely to be wrong: nothing in the
query; the risk is entirely in the `null` contract above being read as "row missing" by `A2b` and
rendering a blank form to a user who should have been redirected.

## B4 notes — the two Server Actions

Both bodies real. Standard `ActionResult`, no throwing for expected failures, and the CLAUDE.md §3.2
opening triple — `requireSession` → role/authorization guard → zod — in that order in both.

### `submitReview` — its authorization *is* Rule 1

`getDeal(auctionId, session.userId) === null ⇒ refuse`. There is deliberately **no second permission model
here**: the same query that decides whether you may see someone's phone number decides whether you may
review them, so the two cannot drift. Keyed on `session.userId`, never on anything the client sent.

Note the asymmetry, because it is the thing to get wrong: Rule 1 gates who may *write* a review. It never
gates who may read one. A star average is public the moment it exists (§2, Rule 2).

**The row and the aggregate are written in one `$transaction`.** That is the entire justification for
trusting `ratingSum`/`ratingCount`: "the aggregate equals the sum of the rows" is not a claim needing
periodic reconciliation, it is a property of every write. `increment` rather than read-modify-write, or two
people rating the same carrier in the same instant would lose one of the two ratings.

**Double submit is handled twice, on purpose.** `deal.iReviewed` produces the friendly message; the
`@@unique([auctionId, authorId])` constraint is what actually guarantees it, and the `P2002` catch turns
the loser of a genuine race into the same friendly message. Because the insert is *inside* the
transaction, the loser's increment rolls back with it — the aggregate cannot double-count.

`revalidatePath` is **deliberately not exhaustive**. A star average appears on every bid row in the app, so
the only complete invalidation would be the whole tree; the five paths listed are the ones a reviewer or
subject looks at next, and everything else is dynamic and polls, so it self-corrects within a refresh.

### `updateContactDetails` — the payload picks the shape, the database picks the identity

`ContactDetailsSchema` is discriminated on `role`, but that discriminator is **checked against the
database**, not trusted. A carrier submitting a shipper payload is refused rather than quietly writing
`companyName` onto a carrier row.

Against the *database* and not the session, specifically: a session is a snapshot and can be minutes old.
That read pays for itself twice, because it also carries `detailsCompletedAt`, which decides whether this
save is the first completion or an edit — **an edit must not move the timestamp**, or the column stops
meaning what its name says.

Only the fields belonging to the user's role are written. The other role's columns are left alone rather
than nulled: nothing reads them, and blanking them would destroy data if roles ever became mutable.

`revalidatePath("/", "layout")` — the whole tree, because `B5` puts `detailsComplete` in the session and
every guard in the app therefore changes on this write. The one place the blunt instrument is right.

### Why there are no tests for these two

Consistent with the rest of the repo: `submitBid` and `acceptBid` have none either. A Server Action here is
`requireSession` + guards + Prisma, so a unit test would be a test of three mocks agreeing with each other.
The *rules* are tested where they are pure — `contact.test.ts` covers the authorization these actions
delegate to, and `bids.test.ts` / `auction-close.test.ts` cover the others. What is genuinely untested is
the plumbing, and that needs a database, which is `B7` plus a browser.

**NOT VERIFIED (B4):** `typecheck` / `lint` / `test` (86, 8 files) green. **Neither action has ever run.**
Ranked by what would hurt most if wrong:

1. **`Prisma.PrismaClientKnownRequestError` narrowing.** Imported as a *value* from
   `@/generated/prisma/client`, which typechecks — but if Prisma 7 wraps errors differently through the
   `pg` driver adapter, the `instanceof` silently fails and a double-submit shows "Could not save your
   review" instead of the friendly message. Reproduce by submitting two reviews for one auction.
2. **The `$transaction` array form with `increment`.** If the increment lands but the create rolls back —
   or vice versa — the aggregate diverges permanently, and nothing recomputes it. Worth checking the row
   count against `ratingCount` in Studio once after `B7`.
3. **`detailsCompletedAt` staying put across an edit.** Save the details form twice and confirm the
   timestamp does not move.
4. **The role-mismatch branch**, which no UI can reach — it needs the action called directly with a
   `role: "SHIPPER"` payload from a carrier session.
