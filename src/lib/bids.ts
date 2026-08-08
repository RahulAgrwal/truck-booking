/**
 * Bid list rules (TechnicalDocument.md §3.3), as pure functions.
 *
 * A carrier may bid many times on one auction — it is a reverse auction, so
 * they lower their own price. The list a shipper sees must therefore collapse
 * that history to one row per carrier before anything is ranked, or a carrier
 * who bid three times looks like three competitors.
 *
 * Split out of the page because §8.1 asks for it to be tested, and because A5
 * (the list) and A6 (accepting) both need the same answer for "which bid is
 * the best one".
 */

/** The minimum a bid needs for these rules. Prisma rows satisfy it structurally. */
export type RankableBid = {
  id: string;
  carrierId: string;
  amount: number;
  createdAt: Date | string;
};

function time(value: Date | string): number {
  return typeof value === "string" ? new Date(value).getTime() : value.getTime();
}

/**
 * One row per carrier — **their latest bid** — ordered by amount ascending.
 *
 * "Latest", not "lowest", is what §3.3 specifies. In practice they coincide,
 * because `submitBid` guard 6 refuses a bid that does not undercut the
 * carrier's own previous one. They are kept distinct anyway: if that guard is
 * ever relaxed, this should show what the carrier currently stands behind, not
 * the best number they ever said.
 *
 * A tie on `createdAt` (same millisecond) takes the lower amount, so the
 * result is deterministic rather than dependent on query order.
 */
export function latestBidPerCarrier<T extends RankableBid>(bids: readonly T[]): T[] {
  const latest = new Map<string, T>();

  for (const bid of bids) {
    const current = latest.get(bid.carrierId);
    if (!current) {
      latest.set(bid.carrierId, bid);
      continue;
    }

    const newer = time(bid.createdAt) - time(current.createdAt);
    if (newer > 0 || (newer === 0 && bid.amount < current.amount)) {
      latest.set(bid.carrierId, bid);
    }
  }

  return [...latest.values()].sort(
    (a, b) => a.amount - b.amount || time(a.createdAt) - time(b.createdAt),
  );
}

/**
 * The "Best Price" badge: the single global minimum. **On a tie, the earliest
 * `createdAt` wins** — whoever got there first.
 *
 * Returns an id rather than a bid so the caller compares by identity and
 * cannot accidentally badge two rows that happen to share an amount.
 */
export function bestBidId(bids: readonly RankableBid[]): string | null {
  let best: RankableBid | null = null;

  for (const bid of bids) {
    if (
      !best ||
      bid.amount < best.amount ||
      (bid.amount === best.amount && time(bid.createdAt) < time(best.createdAt))
    ) {
      best = bid;
    }
  }

  return best?.id ?? null;
}
