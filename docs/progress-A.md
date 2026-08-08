# Lane A Progress — foundation, auth, Shipper vertical, cron, deploy

Owned by **Claude 1**. Step definitions: [`../BuildPlan.md` §6](../BuildPlan.md).
Status values: `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED(<gate>)`

| Step | Title | Gate | Status | Commit | Notes |
|------|-------|------|--------|--------|-------|
| A0 | Scaffold, database, container, Cloud Build | — | **DONE** | | Lane B's B0 gate is OPEN |
| A1 | Firebase auth + session | — | TODO | | |
| A2 | Onboarding & role routing | — | TODO | | |
| A3 | Shipper dashboard | `auction-card.tsx` + `mobile-nav.tsx` | TODO | | |
| A4 | Create auction | `ui/button.tsx` | TODO | | |
| A5 | Shipper auction details + live bids | `timer.tsx` + `bid-card.tsx` | TODO | | |
| A6 | Accept-bid transaction + cron | A5 | TODO | | |
| A7 | Shipper history + deploy docs | A6 | TODO | | |

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

## Google Maps — status
Schema + migration + seed data: **done in A0**. `LocationAutocomplete.tsx`, `src/lib/maps.ts` and
`calculateRouteAndCreateAuction`: **A4**. Note the ownership carve-out — `src/components/LocationAutocomplete.tsx`
sits in Lane B's tree but is **owned by Lane A** (BuildPlan §3, TechnicalDocument §10.3).
Both Maps keys are currently blank in `.env.local`, so the autocomplete runs in degraded mode
(plain text input, null coordinates) — by design, so neither lane is blocked on a billing-enabled key.

## HANDOFF TO B
_Defects found in Lane B files. Report, do not fix._

## Blockers log
_`<timestamp> — waiting on <gate>; re-checking in 60s`_
