# Lane A Progress — foundation, auth, Shipper vertical, cron, deploy

Owned by **Claude 1**. Step definitions: [`../BuildPlan.md` §6](../BuildPlan.md).
Status values: `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED(<gate>)`

| Step | Title | Gate | Status | Commit | Notes |
|------|-------|------|--------|--------|-------|
| A0 | Scaffold, database, container, Cloud Build | — | TODO | | unblocks Lane B — push fast |
| A1 | Firebase auth + session | — | TODO | | |
| A2 | Onboarding & role routing | — | TODO | | |
| A3 | Shipper dashboard | `auction-card.tsx` + `mobile-nav.tsx` | TODO | | |
| A4 | Create auction | `ui/button.tsx` | TODO | | |
| A5 | Shipper auction details + live bids | `timer.tsx` + `bid-card.tsx` | TODO | | |
| A6 | Accept-bid transaction + cron | A5 | TODO | | |
| A7 | Shipper history + deploy docs | A6 | TODO | | |

## Resolved versions
_A0 records the actual `npm`-resolved Next.js / Prisma / Tailwind versions here and in TechnicalDocument.md §2.1._

## HANDOFF TO B
_Defects found in Lane B files. Report, do not fix._

## Blockers log
_`<timestamp> — waiting on <gate>; re-checking in 60s`_
