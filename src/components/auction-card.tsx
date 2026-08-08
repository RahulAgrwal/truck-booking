import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/design/cn";
import { formatINR, formatWeight } from "@/lib/format";

import { RouteRow } from "./route-row";
import { Timer } from "./timer";
import { Badge, LiveBadge } from "./ui/badge";
import { Icon } from "./ui/icon";

/**
 * The auction card, in both of its Stitch forms.
 *
 * `variant` is not cosmetic — the two dashboards show genuinely different
 * information, so the markup differs rather than sharing one layout with
 * things hidden:
 *
 * - `shipper` (Stitch `2a58c34e…`) — "how is MY auction doing": LIVE badge,
 *   countdown, horizontal route, weight/material, and a bid count.
 * - `carrier` (Stitch `36d28947…`) — "should I bid on this": the current price
 *   in `display-price`, an expiry chip, a vertical route with times, meta
 *   pills, and a View & Bid button.
 *
 * Props are a plain serialisable view model, never a Prisma row — this crosses
 * into a client subtree via `Timer` (CLAUDE.md §3.2).
 */
export type AuctionCardData = {
  id: string;
  pickupLocation: string;
  dropoffLocation: string;
  materialDetails: string;
  weightKg: number;
  /** Absolute ISO instant — never a precomputed duration. */
  endTime: string;
  bidCount: number;
  /** Lowest bid so far, or the starting price when nobody has bid. */
  currentPrice: number | null;
  /** Route distance where Maps resolved it; null in degraded mode (§10.3). */
  distanceKm?: number | null;
  pickupAt?: string | null;
  dropoffAt?: string | null;
};

export function AuctionCard({
  auction,
  variant,
  className,
}: {
  auction: AuctionCardData;
  variant: "shipper" | "carrier";
  className?: string;
}) {
  return variant === "shipper" ? (
    <ShipperAuctionCard auction={auction} className={className} />
  ) : (
    <CarrierAuctionCard auction={auction} className={className} />
  );
}

/** Stitch `2a58c34ed93845e29def176c80cc2648` — Shipper Dashboard. */
function ShipperAuctionCard({
  auction,
  className,
}: {
  auction: AuctionCardData;
  className?: string;
}) {
  const hasBids = auction.bidCount > 0;

  return (
    <Link
      href={`/shipper/auction/${auction.id}`}
      className={cn("block", className)}
      aria-label={`Auction ${auction.pickupLocation} to ${auction.dropoffLocation}`}
    >
      <article className="bg-surface-container-lowest border border-surface-variant rounded-lg p-stack-md shadow-[0_4px_12px_rgba(0,33,83,0.08)] transition-transform active:scale-[0.98]">
        <div className="mb-stack-md flex items-start justify-between">
          <LiveBadge />
          <Timer endTime={auction.endTime} variant="bare" />
        </div>

        <RouteRow
          from={auction.pickupLocation}
          to={auction.dropoffLocation}
          className="mb-stack-md"
        />

        <div className="flex items-center justify-between gap-stack-sm bg-surface-container-low p-3 rounded">
          <div className="flex min-w-0 items-center gap-2 font-body-md text-body-md text-on-surface-variant">
            <Icon name="weight" className="text-[18px]" />
            <span className="truncate">
              {formatWeight(auction.weightKg)} • {auction.materialDetails}
            </span>
          </div>
          {/* Orange once bids exist, neutral at zero — the count says which. */}
          <Badge tone={hasBids ? "brand" : "neutral"} shape="rounded" className="shrink-0">
            {auction.bidCount} {auction.bidCount === 1 ? "Bid" : "Bids"}
          </Badge>
        </div>
      </article>
    </Link>
  );
}

/** Stitch `36d28947d9c84715a0d418d3c0a5e2e9` — Carrier Load Feed. */
function CarrierAuctionCard({
  auction,
  className,
}: {
  auction: AuctionCardData;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative flex flex-col gap-stack-sm overflow-hidden rounded-xl p-4",
        "bg-surface-container-lowest border border-surface-variant",
        "shadow-[0_4px_12px_rgba(0,33,83,0.08)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-stack-sm">
        <div className="flex min-w-0 flex-col">
          <span className="font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
            Current Price
          </span>
          {/*
            The mockup reads "Est. Payout" over a $ amount. The app is INR and
            this is a reverse auction — the number is the price to beat, not an
            estimate (CLAUDE.md §6). Both corrections are deliberate.
          */}
          <span className="font-display-price text-display-price text-on-surface">
            {auction.currentPrice === null ? "No bids yet" : formatINR(auction.currentPrice)}
          </span>
        </div>
        <Timer endTime={auction.endTime} variant="chip" className="shrink-0" />
      </div>

      <RouteRow
        orientation="vertical"
        from={auction.pickupLocation}
        to={auction.dropoffLocation}
        fromMeta={auction.pickupAt ?? undefined}
        toMeta={auction.dropoffAt ?? undefined}
      />

      <div className="flex flex-wrap gap-2 border-t border-outline-variant pt-2">
        {typeof auction.distanceKm === "number" ? (
          <MetaPill icon="directions_car">{Math.round(auction.distanceKm)} km</MetaPill>
        ) : null}
        <MetaPill icon="inventory_2">{auction.materialDetails}</MetaPill>
        <MetaPill icon="scale">{formatWeight(auction.weightKg)}</MetaPill>
      </div>

      <Link
        href={`/carrier/auction/${auction.id}`}
        className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary-container font-headline-md text-headline-md text-on-primary-container transition-transform active:scale-[0.98]"
      >
        View &amp; Bid
      </Link>
    </article>
  );
}

function MetaPill({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded bg-surface-container-low px-2 py-1 font-label-bold text-label-bold text-on-surface-variant">
      <Icon name={icon} className="text-[14px]" />
      {children}
    </span>
  );
}
