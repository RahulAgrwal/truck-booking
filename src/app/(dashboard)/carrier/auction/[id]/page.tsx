import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PollingRefresher } from "@/components/polling-refresher";
import { Timer } from "@/components/timer";
import { Icon } from "@/components/ui/icon";
import { isPastDeadline } from "@/lib/auction-close";
import { formatRouteSummary } from "@/lib/design/feed";
import { formatWeight } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

import { BidForm } from "./bid-form";

/**
 * Stitch `69e048b55c6a46a78c57fff5d52fdf6e` — Place a Bid.
 *
 * No bottom nav: this is a pushed, transactional screen, so the only way out
 * is back or submit. The app bar is local rather than `TopAppBar` because the
 * Stitch header is a centred title with a back button, not the feed's
 * avatar/wordmark/bell.
 */
export const dynamic = "force-dynamic";

export default async function PlaceBidPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("CARRIER");
  const { id } = await params;

  const auction = await prisma.auction.findUnique({
    where: { id },
    select: {
      id: true,
      pickupLocation: true,
      dropoffLocation: true,
      materialDetails: true,
      weightKg: true,
      status: true,
      endTime: true,
      shipperId: true,
      distanceKm: true,
      estimatedTimeMins: true,
      // The price to beat: the global minimum across all carriers.
      bids: { orderBy: { amount: "asc" }, take: 1, select: { amount: true } },
    },
  });

  if (!auction) notFound();

  // This carrier's own lowest — guard 6 is what they have to undercut.
  const mine = await prisma.bid.findFirst({
    where: { auctionId: auction.id, carrierId: session.userId },
    orderBy: { amount: "asc" },
    select: { amount: true },
  });

  /*
    Computed on the server, and re-checked inside `submitBid` on write. The
    client `Timer` refreshes this page at zero, which re-renders with
    `expired: true` — but the form being open is never what decides.
  */
  const expired = auction.status !== "ACTIVE" || isPastDeadline(auction.endTime);
  const lowestBid = auction.bids[0]?.amount ?? null;

  return (
    <>
      <header className="relative flex h-touch-target-min w-full shrink-0 items-center justify-center bg-surface px-margin-mobile pt-safe">
        <Link
          href="/carrier"
          aria-label="Back to load feed"
          className="absolute left-margin-mobile flex h-touch-target-min w-touch-target-min items-center justify-center rounded-full text-on-surface active:opacity-80"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="font-headline-md text-headline-md text-on-surface">Submit Bid</h1>
      </header>

      <main className="flex-1 px-margin-mobile pt-stack-sm pb-[calc(env(safe-area-inset-bottom,0px)+160px)]">
        {/* Summary card — everything needed to price the job, in one glance. */}
        <div className="relative mb-stack-lg overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-stack-md shadow-[0_2px_4px_rgba(0,34,80,0.08)]">
          <div className="mb-stack-sm flex items-start justify-between gap-stack-sm">
            <span className="rounded bg-primary-fixed px-2 py-1 font-label-bold text-label-bold uppercase tracking-wider text-primary">
              {expired ? "Closed" : "Open for bids"}
            </span>
            <Timer endTime={auction.endTime.toISOString()} variant="chip" />
          </div>

          <div className="relative mb-stack-md flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="truncate font-headline-md text-headline-md text-on-surface">
                {auction.pickupLocation}
              </div>
              <div className="font-body-md text-body-md text-secondary">Origin</div>
            </div>
            <div className="relative flex flex-1 items-center justify-center px-2">
              <div
                className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 bg-outline-variant"
                aria-hidden="true"
              />
              <Icon
                name="arrow_forward"
                filled
                className="relative z-10 bg-surface-container-lowest px-1 text-primary"
              />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <div className="truncate font-headline-md text-headline-md text-on-surface">
                {auction.dropoffLocation}
              </div>
              <div className="font-body-md text-body-md text-secondary">Destination</div>
            </div>
          </div>

          {/*
            Material, weight and route. §10.4 calls the route line required
            content on this screen — it is the main reason the Maps feature
            exists, because it is what lets a carrier price the job. It
            degrades to "Distance unavailable" rather than vanishing.
          */}
          <div className="flex flex-wrap justify-between gap-stack-sm border-t border-outline-variant pt-stack-sm">
            <Fact icon="inventory_2">{auction.materialDetails}</Fact>
            <Fact icon="scale">{formatWeight(auction.weightKg)}</Fact>
            <Fact icon="route">
              {formatRouteSummary(auction.distanceKm, auction.estimatedTimeMins)}
            </Fact>
          </div>
        </div>

        {expired ? (
          <div className="flex flex-col items-center gap-stack-sm rounded-lg bg-error-container p-stack-md text-center">
            <Icon name="timer_off" filled className="text-on-error-container" />
            <p className="font-body-lg text-body-lg text-on-error-container">
              This auction has closed. No further bids can be placed.
            </p>
            <Link
              href="/carrier"
              className="font-label-bold text-label-bold uppercase tracking-wider text-on-error-container underline"
            >
              Back to load feed
            </Link>
          </div>
        ) : (
          <BidForm
            auctionId={auction.id}
            pickupLocation={auction.pickupLocation}
            dropoffLocation={auction.dropoffLocation}
            lowestBid={lowestBid}
            myLowestBid={mine?.amount ?? null}
            expired={expired}
          />
        )}
      </main>

      {/* Keeps "current lowest" honest while the carrier is deciding (§7.4). */}
      <PollingRefresher />
    </>
  );
}

function Fact({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-secondary">
      <Icon name={icon} className="text-[16px]" />
      <span className="font-body-md text-body-md">{children}</span>
    </span>
  );
}
