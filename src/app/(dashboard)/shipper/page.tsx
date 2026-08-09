import { AppScreen, TopAppBar } from "@/components/app-shell";
import { AuctionCard, type AuctionCardData } from "@/components/auction-card";
import { Fab } from "@/components/fab";
import { MobileNav } from "@/components/mobile-nav";
import { PollingRefresher } from "@/components/polling-refresher";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

/**
 * Stitch screen 2a58c34ed93845e29def176c80cc2648 — "Shipper Dashboard".
 *
 * Active auctions only; everything terminal lives in /shipper/history (A7).
 * Polls so bid counts move without a manual refresh (TechnicalDocument.md §7.4).
 */
export default async function ShipperDashboardPage() {
  const session = await requireRole("SHIPPER");

  const auctions = await prisma.auction.findMany({
    where: { shipperId: session.userId, status: "ACTIVE" },
    orderBy: { endTime: "asc" }, // soonest to expire first — the ones needing a decision
    include: {
      // Lowest bid drives the card's headline price. One row, covered by the
      // (auctionId, amount) index, rather than pulling every bid to reduce it.
      bids: { orderBy: { amount: "asc" }, take: 1, select: { amount: true } },
    },
  });

  /*
    Count distinct CARRIERS, not bid rows.

    A carrier may bid repeatedly to undercut itself (TechnicalDocument.md §3.3),
    so `_count.bids` overstates interest: the seeded Mumbai→Pune auction has
    four bid rows from three carriers. The detail screen reduces to the latest
    bid per carrier, so a raw row count would promise four bids and then show
    three — the shipper would reasonably think one had vanished.
  */
  const bidderGroups = await prisma.bid.groupBy({
    by: ["auctionId", "carrierId"],
    where: { auctionId: { in: auctions.map((a) => a.id) } },
  });

  const bidderCounts = new Map<string, number>();
  for (const group of bidderGroups) {
    bidderCounts.set(group.auctionId, (bidderCounts.get(group.auctionId) ?? 0) + 1);
  }

  const cards: AuctionCardData[] = auctions.map((auction) => ({
    id: auction.id,
    pickupLocation: auction.pickupLocation,
    dropoffLocation: auction.dropoffLocation,
    materialDetails: auction.materialDetails,
    weightKg: auction.weightKg,
    // Absolute ISO instant, never a precomputed duration — RSC payloads are
    // cached, and a duration would already be stale on arrival (§7.3).
    endTime: auction.endTime.toISOString(),
    bidCount: bidderCounts.get(auction.id) ?? 0,
    currentPrice: auction.bids[0]?.amount ?? null,
    distanceKm: auction.distanceKm,
    estimatedTimeMins: auction.estimatedTimeMins,
  }));

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
            <span className="material-symbols-outlined" aria-hidden="true">
              notifications
            </span>
          </button>
        }
      />

      <AppScreen>
        <h2 className="font-headline-md text-headline-md text-on-surface">Active Auctions</h2>

        {cards.length === 0 ? (
          <EmptyState
            icon="local_shipping"
            title="No active auctions"
            body="Post a load and carriers will start bidding on it."
            cta={{ label: "Post a Load", href: "/shipper/create" }}
          />
        ) : (
          <>
            {cards.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} variant="shipper" />
            ))}
            <PollingRefresher />
          </>
        )}
      </AppScreen>

      {/* Hidden when there is nothing to list — the empty state carries its own CTA. */}
      {cards.length > 0 ? <Fab href="/shipper/create" icon="add" label="Post a Load" /> : null}

      <MobileNav role="SHIPPER" />
    </>
  );
}
