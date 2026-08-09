import type { ReactNode } from "react";

import { cn } from "@/lib/design/cn";
import { formatINR, formatRelativeTime, ratingAverage } from "@/lib/format";

import { RatingStars } from "./rating-stars";
import { Avatar } from "./ui/avatar";
import { Badge } from "./ui/badge";

/**
 * One bid, on the shipper's auction-detail screen and in the carrier's My Bids
 * list (TechnicalDocument.md §6.2).
 *
 * Serialisable view model, not a Prisma row.
 */
export type BidCardData = {
  id: string;
  amount: number;
  /** Absolute ISO instant. */
  createdAt: string;
  carrierName: string;
  carrierImage?: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  /**
   * The carrier's reputation, for the shipper deciding between bids.
   *
   * Sum and count rather than a precomputed average, so the card and the
   * accept sheet round identically — one derivation, one answer. Omit on the
   * carrier's own My Bids list, where showing someone their own score beside
   * their own bid says nothing.
   */
  carrierRatingSum?: number;
  carrierRatingCount?: number;
};

export function BidCard({
  bid,
  isBest = false,
  action,
  className,
}: {
  bid: BidCardData;
  /** Lowest live bid. Ties resolve to the earliest — decided by the caller. */
  isBest?: boolean;
  /** The Accept control, on the shipper's side only. */
  action?: ReactNode;
  className?: string;
}) {
  const accepted = bid.status === "ACCEPTED";

  return (
    <article
      className={cn(
        "bg-surface-container-lowest rounded-lg p-gutter-mobile",
        "shadow-[0_4px_12px_rgba(0,33,83,0.08)]",
        // A won bid is outlined, not just tinted — §7.7 forbids colour as the
        // only signal, and the "Won" badge below carries the word.
        accepted ? "border-2 border-tertiary" : "border border-surface-variant",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-stack-sm">
        <div className="flex min-w-0 items-center gap-stack-sm">
          <Avatar src={bid.carrierImage} name={bid.carrierName} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-body-lg text-body-lg text-on-surface">
              {bid.carrierName}
            </span>
            {/*
              The line the Stitch mockup drew as "★ 4.8 (124 trips)" and A5 had
              to drop for want of data. It sits directly under the name because
              this row is where a shipper compares one carrier against another,
              and price alone was never enough to decide on.
            */}
            {bid.carrierRatingCount !== undefined ? (
              <RatingStars
                average={ratingAverage(bid.carrierRatingSum ?? 0, bid.carrierRatingCount)}
                count={bid.carrierRatingCount}
              />
            ) : null}
            <span className="font-body-md text-body-md text-on-surface-variant">
              {formatRelativeTime(bid.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-unit">
          <span
            className={cn(
              "font-display-price text-display-price",
              accepted ? "text-tertiary" : "text-on-surface",
            )}
          >
            {formatINR(bid.amount)}
          </span>
          {accepted ? (
            <Badge tone="success">Won</Badge>
          ) : isBest ? (
            <Badge tone="brand">Best Price</Badge>
          ) : null}
        </div>
      </div>

      {action ? <div className="mt-stack-md">{action}</div> : null}
    </article>
  );
}
