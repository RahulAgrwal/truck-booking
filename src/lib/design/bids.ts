/**
 * The My Bids screen's tab model and status resolution.
 *
 * Same reasoning as `nav.ts` and `feed.ts`: shared between a Server Component
 * and a client island, and pure enough to unit test. Under `src/lib/design/`
 * because that is Lane B's tree (BuildPlan.md §3).
 */

export type BidTabKey = "pending" | "won" | "lost";
export type BidStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type AuctionStatus = "ACTIVE" | "CLOSED_EXPIRED" | "COMPLETED_ASSIGNED";

export type BidTab = {
  key: BidTabKey;
  label: string;
  /** The `Bid.status` this tab selects. */
  status: BidStatus;
};

export const BID_TABS: readonly BidTab[] = [
  { key: "pending", label: "Pending", status: "PENDING" },
  { key: "won", label: "Won", status: "ACCEPTED" },
  { key: "lost", label: "Lost", status: "REJECTED" },
] as const;

/** URL `?tab=` → a tab. Anything unrecognised falls back to Pending. */
export function parseBidTab(raw: string | string[] | undefined): BidTabKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return BID_TABS.find((tab) => tab.key === value)?.key ?? "pending";
}

export function statusForTab(tab: BidTabKey): BidStatus {
  return BID_TABS.find((item) => item.key === tab)?.status ?? "PENDING";
}

export type ResolvedBidStatus = {
  /** Always a word. Colour never carries the meaning on its own (§7.7). */
  label: string;
  tone: "brand" | "neutral" | "success";
  /** Only a bid that can still be won gets a live countdown. */
  showTimer: boolean;
};

/**
 * What a bid's row actually says.
 *
 * The case worth care is the fourth: a **PENDING bid on an expired auction**.
 * Cron sets `CLOSED_EXPIRED` and deliberately leaves the bids `PENDING` —
 * nobody won (TechnicalDocument.md §5.5). So the bid is still `PENDING` and
 * still appears under the Pending tab, but calling it "Pending" would promise
 * an outcome that can never arrive. It reads "Auction expired" instead.
 *
 * `endTime` is checked directly rather than trusting `auction.status`, because
 * cron lags by up to 60s — the same reason `submitBid`'s guard 4 exists.
 */
export function resolveBidStatus(
  bidStatus: BidStatus,
  auctionStatus: AuctionStatus,
  endTime: Date | string,
  now: Date | number = Date.now(),
): ResolvedBidStatus {
  if (bidStatus === "ACCEPTED") {
    return { label: "Won", tone: "success", showTimer: false };
  }
  if (bidStatus === "REJECTED") {
    return { label: "Lost", tone: "neutral", showTimer: false };
  }

  const end = typeof endTime === "string" ? new Date(endTime).getTime() : endTime.getTime();
  const from = typeof now === "number" ? now : now.getTime();
  const live = auctionStatus === "ACTIVE" && end > from;

  return live
    ? { label: "Pending", tone: "brand", showTimer: true }
    : // Still PENDING in the database, but nothing further will happen to it.
      { label: "Auction expired", tone: "neutral", showTimer: false };
}

/** Per-tab empty copy — a shared "nothing here" would be useless on all three. */
export function emptyStateFor(tab: BidTabKey): { icon: string; title: string; body: string } {
  switch (tab) {
    case "won":
      return {
        icon: "emoji_events",
        title: "No wins yet",
        body: "When a shipper accepts one of your bids, it moves here.",
      };
    case "lost":
      return {
        icon: "history",
        title: "Nothing lost yet",
        body: "Bids a shipper passed over will show up here.",
      };
    default:
      return {
        icon: "gavel",
        title: "No pending bids",
        body: "Bids you've placed appear here while their auctions run.",
      };
  }
}
