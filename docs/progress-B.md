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
| B3 | `[ ]` | Carrier load feed | `session.ts` + `schema.prisma` | | gate already satisfied by A1 · Stitch `36d28947…` |
| B4 | `[ ]` | Place a bid | `schemas.ts` | | gate already satisfied by A1 · Stitch `69e048b5…` + `16fc1711…` |
| B5 | `[ ]` | My Bids | B4 | | hand-built → start at Mobbin |
| B6 | `[ ]` | Profile, state coverage, a11y pass | B5 | | hand-built → start at Mobbin |

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

**Ran clean over B0 + B1 + B2** once the other lane's `npm install` finished:

- `npm run typecheck` — **passes** (found and fixed one real defect: `NAV_ITEMS[role][0]` is
  `NavItem | undefined` under `noUncheckedIndexedAccess`)
- `npm run lint` — **passes**, exit 0
- `npm run test` — **18 passed**, 2 files (Lane A's 11 formatter tests + B2's 7 nav tests)
- discipline greps — no breakpoint variants, no raw hex outside `tokens.ts`, no `any`

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

## DEPS ADDED
_Packages this lane installed. The other lane must re-run `npm install` after pulling._

**None.** B0 added no dependencies and B1 will not either.

## DEPS REQUESTED
_Removals and upgrades only — additions each lane makes itself (BuildPlan §3)._

**Empty.**

## HANDOFF TO A
_Defects found in Lane A files, and requests. Report, do not fix._

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

- `B0` — none. Gate (`package.json`) was already satisfied.
