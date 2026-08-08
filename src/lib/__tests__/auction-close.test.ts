import { describe, expect, it } from "vitest";

import {
  expiredAuctionWhere,
  shouldClose,
  type AuctionStatus,
  type ClosableAuction,
} from "../auction-close";

const NOW = new Date("2026-08-09T12:00:00Z");
const now = NOW.getTime();

const auction = (status: AuctionStatus, iso: string): ClosableAuction => ({
  status,
  endTime: new Date(iso),
});

describe("shouldClose", () => {
  it("closes an ACTIVE auction whose deadline has passed", () => {
    expect(shouldClose(auction("ACTIVE", "2026-08-09T11:59:00Z"), now)).toBe(true);
  });

  it("leaves an ACTIVE auction that is still running", () => {
    expect(shouldClose(auction("ACTIVE", "2026-08-09T12:01:00Z"), now)).toBe(false);
  });

  it("treats the exact deadline as expired", () => {
    // lte, not lt — and the same boundary submitBid guard 4 uses. Disagreeing
    // by a millisecond would leave a window where bids are refused but the
    // auction is not yet closed.
    expect(shouldClose(auction("ACTIVE", "2026-08-09T12:00:00Z"), now)).toBe(true);
  });

  it("never touches a COMPLETED_ASSIGNED auction, however long ago it ended", () => {
    // The important one: the sweep must not be able to un-assign a won auction.
    expect(shouldClose(auction("COMPLETED_ASSIGNED", "2026-08-01T00:00:00Z"), now)).toBe(false);
  });

  it("is a no-op on an already-closed auction, so a second run closes nothing", () => {
    expect(shouldClose(auction("CLOSED_EXPIRED", "2026-08-09T11:00:00Z"), now)).toBe(false);
  });

  it("accepts an ISO string", () => {
    expect(shouldClose({ status: "ACTIVE", endTime: "2026-08-09T11:00:00Z" }, now)).toBe(true);
  });
});

describe("expiredAuctionWhere", () => {
  it("filters on ACTIVE and lte, which is what makes the sweep idempotent", () => {
    const where = expiredAuctionWhere(NOW);
    expect(where.status).toBe("ACTIVE");
    expect(where.endTime.lte).toBe(NOW);
  });

  /**
   * The point of this file: the predicate and the Prisma filter must encode the
   * same rule. The filter cannot be executed here, so it is interpreted — if
   * someone edits one definition and not the other, this fails.
   */
  it("agrees with shouldClose on every case", () => {
    const cases: ClosableAuction[] = [
      auction("ACTIVE", "2026-08-09T11:00:00Z"),
      auction("ACTIVE", "2026-08-09T12:00:00Z"),
      auction("ACTIVE", "2026-08-09T13:00:00Z"),
      auction("CLOSED_EXPIRED", "2026-08-09T11:00:00Z"),
      auction("COMPLETED_ASSIGNED", "2026-08-09T11:00:00Z"),
      auction("COMPLETED_ASSIGNED", "2026-08-09T13:00:00Z"),
    ];

    const where = expiredAuctionWhere(NOW);
    const matchesWhere = (a: ClosableAuction) =>
      a.status === where.status && new Date(a.endTime).getTime() <= where.endTime.lte.getTime();

    for (const a of cases) {
      expect(matchesWhere(a), `${a.status} ending ${String(a.endTime)}`).toBe(shouldClose(a, now));
    }
  });
});
