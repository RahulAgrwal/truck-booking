# Stitch Screen Registry

**Project:** `TruckingGO Logistics Marketplace` · **Project ID:** `5704144700317982042`

## How to fetch a screen

```
mcp__stitch__list_screens(projectId: "5704144700317982042")
```

Returns every screen with a **freshly signed** `htmlCode.downloadUrl` and `screenshot.downloadUrl`.

> **The download URLs expire.** Always re-run `list_screens` to get a current URL; never reuse one copied
> from an old transcript or from this file.

Then download the HTML and read it — the exact Tailwind classes are the spec. Do **not** eyeball the
screenshot and guess:

```bash
curl -sL -o screen.html "<downloadUrl>"
```

A single screen can also be fetched directly:

```
mcp__stitch__get_screen(name: "projects/5704144700317982042/screens/<screenId>")
```

## Screen → route → owning step

| Stitch title | Screen ID | Route | Step | Lane |
|---|---|---|---|---|
| Splash & Login | `23b5db873d684cb1af8e716879c4ab9f` | `/login` | `A1` | A |
| Role Selection | `a3fd9497fe1c40d08b56ba95c58202d7` | `/onboarding` | `A2` | A |
| Shipper Dashboard | `2a58c34ed93845e29def176c80cc2648` | `/shipper` | `A3` | A |
| Create Auction Form | `5351d3902a5149ed91c6e59678e51bd1` | `/shipper/create` | `A4` | A |
| Shipper Auction Details | `d8dfb998516d446181dd7245c2c45e7a` | `/shipper/auction/[id]` | `A5` | A |
| Carrier Load Feed | `36d28947d9c84715a0d418d3c0a5e2e9` | `/carrier` | `B3` | B |
| Place a Bid (Carrier) | `69e048b55c6a46a78c57fff5d52fdf6e` | `/carrier/auction/[id]` | `B4` | B |
| Bid Confirmation Success | `16fc1711669148ceac2c4d7f91f79014` | `/carrier/auction/[id]` success view | `B4` | B |
| TruckingGO Logo | `70b66552da1549d8a24ee67735b7e067` | brand asset → `public/icons/*` | `B0` | B |
| Animated SVG | `8067565707f14109bb5219535c1dd89c` | optional splash animation | `B0` | B |

All frames are `MOBILE`, 780 × 1768 (Carrier Load Feed is 780 × 2252 — it scrolls).

## Screens that do NOT exist in Stitch

Build these from the design system in [`CLAUDE.md` §4](../CLAUDE.md#4-design-system). Do **not** generate
new Stitch screens for them, and do not invent new visual language.

| Route | Step | Lane | Compose from |
|---|---|---|---|
| `/carrier/bids` (My Bids) | `B5` | B | segmented control + `BidCard` + status chips |
| `/profile` | `B6` | B | `Avatar` + role `Badge` + `Sheet` sign-out confirm |
| `/shipper/history` | `A7` | A | `AuctionCard` variant + terminal-status chip |

## Design tokens

The token set extracted from these screens is transcribed in [`CLAUDE.md` §4](../CLAUDE.md#4-design-system)
and is the single source of truth. **It supersedes PRD §6.** If a Stitch screen's markup ever disagrees
with CLAUDE.md §4, the markup wins — fix CLAUDE.md and note it in your ledger.
