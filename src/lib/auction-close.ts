/**
 * The auction expiry rule (TechnicalDocument.md §5.5), in one place.
 *
 * The cron sweep runs as a single `updateMany`, so the rule really lives in a
 * Prisma `WHERE` clause — which no unit test can execute. Rather than write a
 * predicate that only *resembles* the query, both are defined here from the
 * same statement of the rule, and `auction-close.test.ts` asserts they agree
 * case for case. If someone changes one, the test fails on the other.
 */

export type AuctionStatus = "ACTIVE" | "CLOSED_EXPIRED" | "COMPLETED_ASSIGNED";

export type ClosableAuction = {
  status: AuctionStatus;
  endTime: Date | string;
};

/**
 * The `WHERE` for the sweep: still running, and the deadline has arrived.
 *
 * `lte`, not `lt` — an auction whose `endTime` is exactly now is over. The same
 * boundary as `submitBid` guard 4, which rejects a bid at `endTime <= now`;
 * disagreeing by one millisecond would leave a window where a bid is refused
 * but the auction is not yet closed.
 *
 * `status: 'ACTIVE'` is what makes this safe to run beside `acceptBid`: an
 * auction already flipped to `COMPLETED_ASSIGNED` no longer matches, so the
 * sweep can never un-assign a won auction.
 */
export function expiredAuctionWhere(now: Date = new Date()) {
  return { status: "ACTIVE" as const, endTime: { lte: now } };
}

/**
 * Has this deadline passed?
 *
 * Lives here rather than inline as `endTime.getTime() <= Date.now()` in a page,
 * for two reasons. It is the same `lte` boundary as the sweep and as
 * `submitBid` guard 4, so it belongs beside them; and React's compiler lint
 * rejects an impure call like `Date.now()` in a component body, which is a fair
 * complaint even in a Server Component — the value is request-scoped, not
 * render-scoped, and burying it in JSX invites someone to memoise a screen
 * around a clock reading.
 */
export function isPastDeadline(endTime: Date | string, now: Date | number = Date.now()): boolean {
  const end = typeof endTime === "string" ? new Date(endTime).getTime() : endTime.getTime();
  const from = typeof now === "number" ? now : now.getTime();
  return end <= from;
}

/** The same rule as a predicate, for tests and for any future in-memory use. */
export function shouldClose(auction: ClosableAuction, now: Date | number = Date.now()): boolean {
  if (auction.status !== "ACTIVE") return false;

  const end =
    typeof auction.endTime === "string" ? new Date(auction.endTime).getTime() : auction.endTime.getTime();
  const from = typeof now === "number" ? now : now.getTime();

  return end <= from;
}
