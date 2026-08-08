# Lane B Progress — design system, shared components, Carrier vertical

Owned by **Claude 2**. Step definitions: [`../BuildPlan.md` §6](../BuildPlan.md).
Status values: `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED(<gate>)`

> **Lane identity.** The user assigned this session Claude 2 / Lane B directly (CLAUDE.md §0).
> `docs/LANE.md` in this checkout reads `LANE: A` — **both instances are running in the same working
> directory**, and Lane A owns that file, so it is left alone. If this session is resumed after a
> compaction, trust this line, not `LANE.md`.

| Step | Title | Gate | Status | Commit | Notes |
|------|-------|------|--------|--------|-------|
| B0 | Design tokens, global styles, PWA shell | `package.json` | **DONE** | | B1 gate is OPEN (`@theme` present) |
| B1 | UI primitives | `@theme` in `globals.css` | TODO | | gate corrected — there is no `tailwind.config.ts` |
| B2 | Shared components | B1 | TODO | | opens A3 + A5 gates — push promptly |
| B3 | Carrier load feed | `session.ts` + `schema.prisma` | TODO | | gate already satisfied by A1 |
| B4 | Place a bid | `schemas.ts` | TODO | | gate already satisfied by A1 |
| B5 | My Bids | B4 | TODO | | |
| B6 | Profile, state coverage, a11y pass | B5 | TODO | | |

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

**⚠ Committed UNVERIFIED, by explicit user instruction.** None of the Definition of Done gates were run for
`B0`: no `npm run typecheck`, no `npm run lint`, no `npm run build`, and no 390×844 or PWA-install pass.
`node_modules` was being deleted and reinstalled by the other lane throughout this step, so the toolchain
was not runnable at commit time regardless. The one accept criterion that *was* checked is the banned-hex
grep over `src/`, which passes.

**Lane A: re-run the gates before trusting this.** The likeliest failure points, in order: (1) the
`@theme inline` font block — if `font-headline-md` renders as a fallback sans rather than Inter, that is
the culprit; (2) the `pt-safe` / `pb-safe` `@utility` names colliding with Tailwind's dynamic `pt-*`
resolution; (3) `AppScreen`'s nested-`calc(env(…))` arbitrary values. All three are contained in two files.

`npm run db:seed` was **not** run (user instruction); `B0` touches no data.

## DEPS REQUESTED
_Packages Lane A must add to `package.json` — Lane B never edits it. Lane A picks these up at its next step
boundary._

**Empty.** B0 added no dependencies and B1 will not either.

## HANDOFF TO A
_Defects found in Lane A files, and requests. Report, do not fix._

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

3. **`src/app/favicon.ico` was replaced** — heads-up, it sits in your tree. It was still the Next.js
   scaffold default (the Vercel triangle). It is now the TruckingGO mark at 16/32/48. No lane's ownership
   list names this file, and it is the only path Next 16 actually serves a favicon from; a copy also lives
   at `public/icons/favicon.ico`. Revert it if you disagree.

4. **Optional: `NEXT_PUBLIC_SITE_URL` in `.env.example`.** `metadata.ts` uses it as `metadataBase` so OG
   image URLs resolve absolutely, and falls back to `http://localhost:3000` when unset — so nothing breaks
   without it, but social cards will point at localhost in production until it is set to the Cloud Run URL.
   It is a public, non-secret value; safe as a plain build/runtime env var.

5. **We share one working directory.** `node_modules` was deleted and reinstalled underneath this step
   mid-verification. Not a complaint — just flagging that `npm install` / `npm run build` here is not
   isolated between us, so a failing command may be the other lane's install rather than a real break.
   Re-run before believing it.

## Blockers log
_`<timestamp> — waiting on <gate>; re-checking in 60s`_

- `B0` — none. Gate (`package.json`) was already satisfied.
