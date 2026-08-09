import { AppScreen, TopAppBar } from "@/components/app-shell";
import { AuctionCard, type AuctionCardData } from "@/components/auction-card";
import { MobileNav } from "@/components/mobile-nav";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

/**
 * Shipper history — hand-built; no Stitch screen (CLAUDE.md §4.6).
 *
 * Only **terminal** auctions: assigned or expired. Live ones belong on the
 * dashboard, and showing them twice would make "history" mean nothing.
 *
 * No `PollingRefresher`: nothing on this screen can change. §3.2 has no arrow
 * out of either terminal state, so polling it would be a request every 7s to
 * re-render identical rows.
 */
export const dynamic = "force-dynamic";

export default async function ShipperHistoryPage() {
  const session = await requireRole("SHIPPER");

  // §5.6, plus what the row needs: the winning amount, and a bid count for
  // auctions that expired without one.
  const auctions = await prisma.auction.findMany({
    where: {
      shipperId: session.userId,
      status: { in: ["CLOSED_EXPIRED", "COMPLETED_ASSIGNED"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bids: true } },
      bids: {
        where: { status: "ACCEPTED" },
        take: 1,
        select: { amount: true },
      },
    },
  });

  const cards: AuctionCardData[] = auctions.map((auction) => ({
    id: auction.id,
    pickupLocation: auction.pickupLocation,
    dropoffLocation: auction.dropoffLocation,
    materialDetails: auction.materialDetails,
    weightKg: auction.weightKg,
    endTime: auction.endTime.toISOString(),
    bidCount: auction._count.bids,
    currentPrice: null,
    status: auction.status,
    // Null on an expired auction — nobody won, so there is no price (§5.5).
    winningAmount: auction.bids[0]?.amount ?? null,
  }));

  return (
    <>
      <TopAppBar title="History" />

      <AppScreen>
        {cards.length === 0 ? (
          <EmptyState
            icon="history"
            title="No past loads yet"
            body="Auctions move here once they're assigned to a carrier or their deadline passes."
            cta={{ label: "Post a load", href: "/shipper/create" }}
          />
        ) : (
          <ul className="flex list-none flex-col gap-stack-md p-0">
            {cards.map((auction) => (
              <li key={auction.id}>
                <AuctionCard auction={auction} variant="history" />
              </li>
            ))}
          </ul>
        )}
      </AppScreen>

      <MobileNav role="SHIPPER" />
    </>
  );
}
