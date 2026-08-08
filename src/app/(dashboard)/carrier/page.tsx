import { AppScreen, TopAppBar } from "@/components/app-shell";
import { AuctionCard, type AuctionCardData } from "@/components/auction-card";
import { MobileNav } from "@/components/mobile-nav";
import { PollingRefresher } from "@/components/polling-refresher";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import {
  EXPIRING_SOON_MS,
  HIGH_WEIGHT_KG,
  parseFeedFilter,
  parseSearchQuery,
} from "@/lib/design/feed";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

import { FeedFilters } from "./feed-filters";

/**
 * Carrier load feed — Stitch `36d28947d9c84715a0d418d3c0a5e2e9`.
 *
 * A Server Component: `prisma` is server-only and never enters a client import
 * graph (CLAUDE.md §3.2). The two client islands are `FeedFilters` (URL state)
 * and each card's `Timer`.
 *
 * Never cached — the feed is a live auction board, and `searchParams` alone
 * would not stop a stale render being served after `router.refresh()`.
 */
export const dynamic = "force-dynamic";

export default async function CarrierFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Role guard first, always — a SHIPPER landing here is redirected home.
  const session = await requireRole("CARRIER");

  const params = await searchParams;
  const filter = parseFeedFilter(params.filter);
  const query = parseSearchQuery(params.q);

  const now = new Date();

  const auctions = await prisma.auction.findMany({
    where: {
      // §5.6: ACTIVE *and* not yet elapsed. The status column lags by up to
      // 60s until cron sweeps it, so endTime is the authority, not status.
      status: "ACTIVE",
      endTime:
        filter === "expiring"
          ? { gt: now, lte: new Date(now.getTime() + EXPIRING_SOON_MS) }
          : { gt: now },
      ...(filter === "heavy" ? { weightKg: { gte: HIGH_WEIGHT_KG } } : {}),
      ...(query
        ? {
            OR: [
              { pickupLocation: { contains: query, mode: "insensitive" as const } },
              { dropoffLocation: { contains: query, mode: "insensitive" as const } },
              { materialDetails: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    // Closing soonest first: the ones a carrier can still act on.
    orderBy: { endTime: "asc" },
    include: {
      _count: { select: { bids: true } },
      // The price to beat. One row per auction, not the whole bid list — a
      // reverse auction only needs its current minimum.
      bids: { orderBy: { amount: "asc" }, take: 1, select: { amount: true } },
    },
  });

  const cards: AuctionCardData[] = auctions.map((auction) => ({
    id: auction.id,
    pickupLocation: auction.pickupLocation,
    dropoffLocation: auction.dropoffLocation,
    materialDetails: auction.materialDetails,
    weightKg: auction.weightKg,
    // Absolute ISO across the server boundary, never a duration (§7.3).
    endTime: auction.endTime.toISOString(),
    bidCount: auction._count.bids,
    currentPrice: auction.bids[0]?.amount ?? null,
    distanceKm: auction.distanceKm,
    estimatedTimeMins: auction.estimatedTimeMins,
  }));

  const filtered = filter !== "all" || query !== null;

  return (
    <>
      <TopAppBar
        leading={<Avatar src={session.profileImage} name={session.name} size="sm" />}
        title={
          <span className="font-headline-lg text-headline-lg tracking-tight text-primary">
            TruckingGO
          </span>
        }
        trailing={
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-touch-target-min w-touch-target-min items-center justify-center rounded-full text-primary active:opacity-80"
          >
            <Icon name="notifications" />
          </button>
        }
      />

      <AppScreen>
        <FeedFilters filter={filter} query={query ?? ""} />

        {cards.length === 0 ? (
          filtered ? (
            <EmptyState
              icon="search_off"
              title="No loads match those filters"
              body="Try clearing the search or switching back to All."
              cta={{ label: "Show all loads", href: "/carrier" }}
            />
          ) : (
            <EmptyState
              icon="local_shipping"
              title="No loads available right now"
              body="New auctions appear here the moment a shipper posts one. This page refreshes itself."
            />
          )
        ) : (
          <ul className="flex list-none flex-col gap-stack-md p-0">
            {cards.map((auction) => (
              <li key={auction.id}>
                <AuctionCard auction={auction} variant="carrier" />
              </li>
            ))}
          </ul>
        )}
      </AppScreen>

      {/* Bids land constantly; the price on every card is only as fresh as the poll (§7.4). */}
      <PollingRefresher />
      <MobileNav role="CARRIER" />
    </>
  );
}
