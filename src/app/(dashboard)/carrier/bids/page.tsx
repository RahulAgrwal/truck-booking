import Link from "next/link";

import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { RouteRow } from "@/components/route-row";
import { Timer } from "@/components/timer";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import {
  BID_TABS,
  emptyStateFor,
  parseBidTab,
  resolveBidStatus,
  statusForTab,
  type BidTabKey,
} from "@/lib/design/bids";
import { formatINR, formatRelativeTime, formatWeight } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

import { BidTabs } from "./bid-tabs";

/**
 * My Bids — hand-built; there is no Stitch screen for it (CLAUDE.md §4.6).
 *
 * Shape taken from Mobbin's bid/offer lists — eBay "Bids & offers", Whatnot
 * "Activity", Vinted "My orders": status segmentation at the top, and each row
 * leading with the amount and a status word, with time-remaining as the urgent
 * element. Built entirely from B1/B2 primitives; no new visual language.
 */
export const dynamic = "force-dynamic";

export default async function MyBidsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireRole("CARRIER");
  const tab = parseBidTab((await searchParams).tab);

  // §5.6, plus the auction each bid belongs to — the row needs its route,
  // deadline and status to say anything useful.
  const bids = await prisma.bid.findMany({
    where: { carrierId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      auction: {
        select: {
          id: true,
          pickupLocation: true,
          dropoffLocation: true,
          materialDetails: true,
          weightKg: true,
          status: true,
          endTime: true,
        },
      },
    },
  });

  // Counts for all three tabs come from one query — three round trips to put a
  // number on a chip would be silly, and the list is per-carrier and small.
  const counts = BID_TABS.reduce<Record<BidTabKey, number>>(
    (acc, item) => {
      acc[item.key] = bids.filter((bid) => bid.status === item.status).length;
      return acc;
    },
    { pending: 0, won: 0, lost: 0 },
  );

  const visible = bids.filter((bid) => bid.status === statusForTab(tab));
  const empty = emptyStateFor(tab);

  return (
    <>
      <TopAppBar title="My Bids" />

      <AppScreen>
        <BidTabs tab={tab} counts={counts} />

        {visible.length === 0 ? (
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            body={empty.body}
            cta={{ label: "Find loads", href: "/carrier" }}
          />
        ) : (
          <ul className="flex list-none flex-col gap-stack-md p-0">
            {visible.map((bid) => {
              const status = resolveBidStatus(
                bid.status,
                bid.auction.status,
                bid.auction.endTime,
              );

              return (
                <li key={bid.id}>
                  <Link
                    href={`/carrier/auction/${bid.auction.id}`}
                    className="block"
                    aria-label={`Your bid of ${formatINR(bid.amount)} — ${status.label}`}
                  >
                    <article className="rounded-lg border border-surface-variant bg-surface-container-lowest p-gutter-mobile shadow-[0_4px_12px_rgba(0,33,83,0.08)] transition-transform active:scale-[0.98]">
                      <div className="mb-stack-sm flex items-start justify-between gap-stack-sm">
                        {/* Word first, colour second (§7.7). */}
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {status.showTimer ? (
                          <Timer endTime={bid.auction.endTime.toISOString()} variant="chip" />
                        ) : null}
                      </div>

                      <RouteRow
                        from={bid.auction.pickupLocation}
                        to={bid.auction.dropoffLocation}
                        className="mb-stack-sm"
                      />

                      <div className="flex items-end justify-between gap-stack-sm border-t border-outline-variant pt-stack-sm">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
                            Your bid
                          </span>
                          <span className="font-display-price text-display-price text-on-surface">
                            {formatINR(bid.amount)}
                          </span>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-unit text-right">
                          <span className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                            <Icon name="scale" className="text-icon-sm" />
                            {formatWeight(bid.auction.weightKg)}
                          </span>
                          <span className="font-body-md text-body-md text-on-surface-variant">
                            {formatRelativeTime(bid.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/*
                        A won bid is the one row on this screen with something
                        to do rather than something to read: the shipper's
                        number and the rating are a tap away. The row already
                        links there; this says so.
                      */}
                      {bid.status === "ACCEPTED" ? (
                        <p className="mt-stack-sm flex items-center justify-end gap-1 font-label-bold text-label-bold uppercase tracking-wider text-primary">
                          <Icon name="call" className="text-icon-sm" />
                          Contact &amp; rate
                          <Icon name="chevron_right" className="text-icon-sm" />
                        </p>
                      ) : null}
                    </article>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </AppScreen>

      <MobileNav role="CARRIER" />
    </>
  );
}
