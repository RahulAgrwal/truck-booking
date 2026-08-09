import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppScreen, NotificationBell, TopAppBar, Wordmark } from "@/components/app-shell";
import { BidCard } from "@/components/bid-card";
import { ContactCard } from "@/components/contact-card";
import { ReviewSheet } from "@/components/review-sheet";
import { MobileNav } from "@/components/mobile-nav";
import { PollingRefresher } from "@/components/polling-refresher";
import { Timer } from "@/components/timer";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { isPastDeadline } from "@/lib/auction-close";
import { bestBidId, latestBidPerCarrier } from "@/lib/bids";
import { getDeal } from "@/lib/contact";
import { formatRouteSummary } from "@/lib/design/feed";
import { formatINR, formatWeight } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { raterSelect } from "@/lib/reviews";
import { requireRole } from "@/lib/session";

import { AcceptBidSheet } from "./accept-bid-sheet";

/**
 * Shipper auction details — Stitch `d8dfb998516d446181dd7245c2c45e7a`.
 *
 * The live half of the auction: the countdown, and the bids arriving under it.
 * Polls every 7s (§7.4).
 */
export const dynamic = "force-dynamic";

export default async function ShipperAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("SHIPPER");
  const { id } = await params;

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      bids: {
        orderBy: { amount: "asc" },
        // `raterSelect` (Lane B) rather than a hand-written select: one
        // definition of "someone whose reputation we show", so the bid row,
        // the accept sheet and the contact card cannot disagree about it.
        include: { carrier: { select: raterSelect } },
      },
    },
  });

  /*
    404 rather than 403 for another shipper's auction. A "forbidden" page
    confirms the id exists, which is a small enumeration oracle over uuids;
    "not found" tells someone poking at ids exactly as much as they should get.
  */
  if (!auction || auction.shipperId !== session.userId) notFound();

  // §3.3: one row per carrier — their latest bid — then ranked. Reducing
  // before ranking matters: a carrier who bid three times is one competitor.
  const rows = latestBidPerCarrier(auction.bids);
  const bestId = bestBidId(rows);

  const expired = isPastDeadline(auction.endTime);
  const live = auction.status === "ACTIVE" && !expired;
  const acceptedBid = auction.bids.find((bid) => bid.status === "ACCEPTED") ?? null;

  /*
    Rule 1, decided in one place. This returns null for every state except
    "this auction is assigned and I am one of its two parties", so the page
    does not re-derive the condition from `auction.status` — one rule, one
    implementation, and no chance of the two drifting apart.
  */
  const deal = await getDeal(auction.id, session.userId);

  return (
    <>
      <TopAppBar
        title={<Wordmark />}
        trailing={<NotificationBell />}
      />

      <AppScreen className="gap-stack-lg">
        {/* Summary card. The accent bar is the Stitch screen's one flourish. */}
        <section className="relative flex flex-col gap-stack-md overflow-hidden rounded-lg border border-surface-variant bg-surface-container-lowest p-4">
          <div className="absolute top-0 left-0 h-1 w-full bg-primary-container" aria-hidden="true" />

          <div className="flex items-start justify-between gap-stack-sm pt-2">
            <div className="min-w-0">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {auction.pickupLocation} to {auction.dropoffLocation}
              </h2>
              <p className="mt-1 flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                <Icon name="weight" className="text-[16px]" />
                {formatWeight(auction.weightKg)} · {auction.materialDetails}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <span className="mb-1 block font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
                Time Left
              </span>
              {live ? (
                <Timer endTime={auction.endTime.toISOString()} variant="bare" />
              ) : (
                <span className="font-timer-md text-timer-md text-on-surface-variant">Closed</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-stack-sm border-t border-surface-variant pt-2 text-on-surface-variant">
            <Fact icon="route">{formatRouteSummary(auction.distanceKm, auction.estimatedTimeMins)}</Fact>
            <Fact icon="event">
              {auction.endTime.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </Fact>
          </div>
        </section>

        {/*
          Terminal states render read-only. §3.2 has no arrow out of either, so
          an accept button here would be a control that cannot work.
        */}
        {!live ? (
          <StatusBanner
            tone={auction.status === "COMPLETED_ASSIGNED" ? "success" : "neutral"}
            icon={auction.status === "COMPLETED_ASSIGNED" ? "check_circle" : "timer_off"}
            title={
              auction.status === "COMPLETED_ASSIGNED"
                ? `Assigned to ${acceptedBid?.carrier.name ?? "a carrier"}`
                : "Auction expired"
            }
            body={
              auction.status === "COMPLETED_ASSIGNED"
                ? acceptedBid
                  ? `Agreed at ${formatINR(acceptedBid.amount)}. This auction is closed.`
                  : "This auction is closed."
                : "The deadline passed without a bid being accepted. Nobody won."
            }
          />
        ) : null}

        {/*
          The contact exchange. Sits directly under the "Assigned" banner
          because from this moment the screen's job changes: it stops being an
          auction to watch and becomes a job to arrange.
        */}
        {deal ? (
          <>
            <ContactCard party={deal.them} title="Your carrier" />
            <ReviewSheet
              auctionId={auction.id}
              subjectName={deal.them.name}
              alreadyReviewed={deal.iReviewed}
            />
          </>
        ) : null}

        <section className="flex flex-col gap-stack-md">
          <h3 className="font-headline-md text-headline-md text-on-surface">
            {live ? "Live Bids" : "Bids"}{" "}
            <span className="font-body-lg text-body-lg text-on-surface-variant">({rows.length})</span>
          </h3>

          {rows.length === 0 ? (
            <EmptyState
              icon="gavel"
              title={live ? "No bids yet" : "No bids were placed"}
              body={
                live
                  ? "Carriers see this load in their feed. Bids appear here as they arrive — this page refreshes itself."
                  : "This auction closed without any bids."
              }
            />
          ) : (
            <ul className="flex list-none flex-col gap-stack-sm p-0">
              {rows.map((row) => (
                <li key={row.id}>
                  <BidCard
                    bid={{
                      id: row.id,
                      amount: row.amount,
                      createdAt: row.createdAt.toISOString(),
                      carrierName: row.carrier.name,
                      carrierImage: row.carrier.profileImage,
                      status: row.status,
                      carrierRatingSum: row.carrier.ratingSum,
                      carrierRatingCount: row.carrier.ratingCount,
                    }}
                    isBest={live && row.id === bestId}
                    action={
                      live ? (
                        <AcceptBidSheet
                          auctionId={auction.id}
                          bidId={row.id}
                          carrierId={row.carrier.id}
                          carrierName={row.carrier.name}
                          amount={row.amount}
                          isBest={row.id === bestId}
                          carrierRatingSum={row.carrier.ratingSum}
                          carrierRatingCount={row.carrier.ratingCount}
                        />
                      ) : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </AppScreen>

      {/* Bids land while the shipper is looking at the page (§7.4). */}
      {live ? <PollingRefresher /> : null}
      <MobileNav role="SHIPPER" />
    </>
  );
}

function Fact({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1 font-label-bold text-label-bold">
      <Icon name={icon} className="text-[16px]" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function StatusBanner({
  tone,
  icon,
  title,
  body,
}: {
  tone: "success" | "neutral";
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <section
      className={
        tone === "success"
          ? "flex flex-col gap-stack-sm rounded-lg bg-tertiary-container p-stack-md text-on-tertiary-container"
          : "flex flex-col gap-stack-sm rounded-lg bg-surface-container-high p-stack-md text-on-surface"
      }
    >
      <div className="flex items-center gap-stack-sm">
        <Icon name={icon} filled />
        {/* The word, not just the colour (§7.7). */}
        <Badge tone={tone}>{title}</Badge>
      </div>
      <p className="font-body-md text-body-md">{body}</p>
    </section>
  );
}
