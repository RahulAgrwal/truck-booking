# Lane B Progress — design system, shared components, Carrier vertical

Owned by **Claude 2**. Step definitions: [`../BuildPlan.md` §6](../BuildPlan.md).
Status values: `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED(<gate>)`

| Step | Title | Gate | Status | Commit | Notes |
|------|-------|------|--------|--------|-------|
| B0 | Design tokens, global styles, PWA shell | `package.json` | TODO | | waits on A0 |
| B1 | UI primitives | `tailwind.config.ts` | TODO | | |
| B2 | Shared components | B1 | TODO | | opens A3 + A5 gates — push promptly |
| B3 | Carrier load feed | `session.ts` + `schema.prisma` | TODO | | |
| B4 | Place a bid | `schemas.ts` | TODO | | |
| B5 | My Bids | B4 | TODO | | |
| B6 | Profile, state coverage, a11y pass | B5 | TODO | | |

## DEPS REQUESTED
_Packages Lane A must add to `package.json` — Lane B never edits it. Lane A picks these up at its next step
boundary. (A0 pre-installs `tailwindcss-safe-area`; Inter ships via `next/font`; Material Symbols is a
webfont — so this should normally stay empty.)_

## HANDOFF TO A
_Defects found in Lane A files. Report, do not fix._

## Blockers log
_`<timestamp> — waiting on <gate>; re-checking in 60s`_
