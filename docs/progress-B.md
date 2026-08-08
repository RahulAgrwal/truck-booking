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
| B2 | `[~]` | Shared components | B1 | | **opens A3 + A5 gates — push promptly** |
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

## NOT VERIFIED
_Per step: what was skipped, and where it is most likely wrong. This is the worklist BuildPlan §7.2
inherits — see CLAUDE.md §10.2._

**B0** — no `typecheck` / `lint` / `build` / `test`; no 390×844 pass; no PWA-install check. (`node_modules`
was being deleted and reinstalled by the other lane throughout the step, so the toolchain was not runnable
at commit time; verification is deferred by user direction regardless.) The banned-PRD-hex grep over `src/`
**was** run and passes.

Most likely to be wrong, in order:
1. **The `@theme inline` font block.** If `font-headline-md` renders as a system sans instead of Inter,
   this is the cause — `--font-inter` is defined on `<body>` by `next/font`, and the `inline` keyword is
   what makes the reference resolve on the element rather than dying at `:root`.
2. **`pt-safe` / `pb-safe`.** Custom `@utility` names that sit in the same namespace Tailwind's dynamic
   `pt-*` resolves from. If safe-area padding is simply absent, they lost.
3. **`AppScreen`'s nested `calc(env(…))` arbitrary values.** If content hides under the app bar or the
   bottom nav, Tailwind did not emit the class.
4. **`src/app/favicon.ico` vs `metadata.icons`.** Next's file convention may take precedence over the
   config-based icon list; the manifest is unaffected either way, so this is cosmetic.

**B1** — no `typecheck` / `lint` / `build`; nothing rendered. `node_modules` is still half-installed in
this checkout (534 package dirs, but no `.bin` and no `typescript/lib`), so the toolchain could not run.
The discipline greps **were** run and pass: no Tailwind breakpoint variants, no raw hex outside
`tokens.ts`, no `any`, no `@ts-expect-error`.

Most likely to be wrong, in order:
1. **`@keyframes sheet-up` nested inside `@theme`.** If `animate-sheet-up` does nothing, Tailwind wanted
   the keyframes at top level instead — move them out of the block; the `--animate-*` token stays.
2. **`z-60` in `sheet.tsx`.** Relies on v4's bare numeric z-index. If the sheet renders under the app bar,
   that is why; `z-[60]` is the fallback.
3. **`Card`'s `as` prop.** A union of intrinsic element names assigned to a capitalised variable and used
   as JSX — legal, but the least-exercised typing in the set.
4. **`EmptyState`'s `cta` union** (`{label, href} | ReactNode`) and its `isCtaLink` guard.
5. **`ChipRow`'s arbitrary variants** — `[scrollbar-width:none]` and `[&::-webkit-scrollbar]:hidden`.
   Cosmetic if they fail; a visible scrollbar, nothing worse.

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
