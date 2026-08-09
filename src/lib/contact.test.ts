import { describe, expect, it, vi } from "vitest";

import type { AuctionStatus } from "@/generated/prisma/enums";

/*
  `src/lib/prisma.ts` throws at import time when DATABASE_URL is unset, and
  vitest does not load `.env.local`. Only `getDeal` uses the client and nothing
  here calls it, so the module is stubbed rather than pointing the test suite at
  a real database — these are unit tests of a rule, and a rule that needed a
  database to check would not be much of a rule.
*/
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { canExchangeContact, dealWhere } = await import("./contact");

/**
 * Rule 1, tested from both ends (docs/feature-contact-ratings.md §2).
 *
 * Same device as `auction-close.test.ts`: the real filtering happens in a
 * Prisma `WHERE` that cannot run here, so the test **interprets the object
 * `dealWhere` returns** rather than restating the rule a third time. Edit
 * either definition without the other and the agreement test fails.
 *
 * `contact.ts` is `server-only`, but vitest.config.mts aliases that package to
 * its empty build, so the module loads here unchanged.
 */

const SHIPPER = "user-shipper";
const CARRIER = "user-carrier";
const LOSER = "user-losing-carrier";
const STRANGER = "user-stranger";
const AUCTION = "auction-1";

/** The facts a row carries, in the shape both forms of the rule consume. */
type Row = {
  label: string;
  auctionId: string;
  auctionStatus: AuctionStatus;
  shipperId: string;
  /** null = no bid was ever accepted on this auction. */
  acceptedCarrierId: string | null;
};

const rows: Row[] = [
  {
    label: "completed auction with a winner",
    auctionId: AUCTION,
    auctionStatus: "COMPLETED_ASSIGNED",
    shipperId: SHIPPER,
    acceptedCarrierId: CARRIER,
  },
  {
    label: "auction that expired with nobody winning",
    auctionId: AUCTION,
    auctionStatus: "CLOSED_EXPIRED",
    shipperId: SHIPPER,
    acceptedCarrierId: null,
  },
  {
    label: "auction still running",
    auctionId: AUCTION,
    auctionStatus: "ACTIVE",
    shipperId: SHIPPER,
    acceptedCarrierId: null,
  },
  {
    label: "auction marked completed but holding no accepted bid",
    auctionId: AUCTION,
    auctionStatus: "COMPLETED_ASSIGNED",
    shipperId: SHIPPER,
    acceptedCarrierId: null,
  },
  {
    label: "expired auction that somehow holds an accepted bid",
    auctionId: AUCTION,
    auctionStatus: "CLOSED_EXPIRED",
    shipperId: SHIPPER,
    acceptedCarrierId: CARRIER,
  },
  {
    label: "a different auction entirely",
    auctionId: "auction-2",
    auctionStatus: "COMPLETED_ASSIGNED",
    shipperId: SHIPPER,
    acceptedCarrierId: CARRIER,
  },
];

const viewers = [SHIPPER, CARRIER, LOSER, STRANGER];

/**
 * Evaluate the `Prisma.AuctionWhereInput` that `dealWhere` produced against a
 * row, reading the object's actual fields — so a change to its shape shows up
 * here as a failure rather than being quietly ignored.
 */
function matchesWhere(row: Row, viewerId: string): boolean {
  const where = dealWhere(AUCTION, viewerId);

  if (where.id !== row.auctionId) return false;
  if (where.status !== row.auctionStatus) return false;

  const branches = where.OR;
  if (!Array.isArray(branches)) throw new Error("dealWhere no longer returns an OR of two branches.");

  return branches.some((branch) => {
    // Branch 1: the shipper, on an auction that has some accepted bid.
    if (branch.shipperId !== undefined) {
      if (branch.shipperId !== row.shipperId) return false;
      return row.acceptedCarrierId !== null;
    }
    // Branch 2: the carrier whose bid was the accepted one.
    const some = branch.bids?.some;
    if (!some) throw new Error("dealWhere's carrier branch no longer filters on bids.some.");
    if (some.status !== "ACCEPTED") return false;
    return some.carrierId === row.acceptedCarrierId;
  });
}

describe("canExchangeContact", () => {
  const completed = {
    auctionStatus: "COMPLETED_ASSIGNED" as const,
    shipperId: SHIPPER,
    acceptedCarrierId: CARRIER,
  };

  it("lets the shipper see the carrier they hired", () => {
    expect(canExchangeContact({ ...completed, viewerId: SHIPPER })).toBe(true);
  });

  it("lets the winning carrier see the shipper — the rule is symmetric", () => {
    expect(canExchangeContact({ ...completed, viewerId: CARRIER })).toBe(true);
  });

  it("shows a losing carrier nothing", () => {
    expect(canExchangeContact({ ...completed, viewerId: LOSER })).toBe(false);
  });

  it("shows an unrelated third party nothing", () => {
    expect(canExchangeContact({ ...completed, viewerId: STRANGER })).toBe(false);
  });

  it("reveals nothing on an expired auction, because nobody won it", () => {
    expect(
      canExchangeContact({
        auctionStatus: "CLOSED_EXPIRED",
        shipperId: SHIPPER,
        acceptedCarrierId: null,
        viewerId: SHIPPER,
      }),
    ).toBe(false);
  });

  it("reveals nothing while the auction is still running", () => {
    expect(
      canExchangeContact({
        auctionStatus: "ACTIVE",
        shipperId: SHIPPER,
        acceptedCarrierId: null,
        viewerId: SHIPPER,
      }),
    ).toBe(false);
  });

  /**
   * The status column alone is not enough. A COMPLETED_ASSIGNED row with no
   * accepted bid should not exist, but if one is ever produced — by a partial
   * write, a manual fix, a future feature — it must not hand out a phone
   * number belonging to a counterparty who was never chosen.
   */
  it("refuses when the status says completed but no bid was accepted", () => {
    expect(
      canExchangeContact({
        auctionStatus: "COMPLETED_ASSIGNED",
        shipperId: SHIPPER,
        acceptedCarrierId: null,
        viewerId: SHIPPER,
      }),
    ).toBe(false);
  });

  it("refuses an accepted bid on an auction that is not COMPLETED_ASSIGNED", () => {
    expect(
      canExchangeContact({
        auctionStatus: "CLOSED_EXPIRED",
        shipperId: SHIPPER,
        acceptedCarrierId: CARRIER,
        viewerId: CARRIER,
      }),
    ).toBe(false);
  });
});

describe("dealWhere", () => {
  it("pins the auction, the completed status, and exactly two ways in", () => {
    const where = dealWhere(AUCTION, SHIPPER);
    expect(where.id).toBe(AUCTION);
    expect(where.status).toBe("COMPLETED_ASSIGNED");
    expect(where.OR).toHaveLength(2);
  });

  /**
   * Both branches require an ACCEPTED bid to exist — the shipper's included.
   * Without that, a shipper would see contact details on any row whose status
   * column read COMPLETED_ASSIGNED, whether or not anyone had been chosen.
   */
  it("requires an accepted bid in the shipper branch too, not just the carrier's", () => {
    const [shipperBranch, carrierBranch] = dealWhere(AUCTION, SHIPPER).OR ?? [];
    expect(shipperBranch?.bids?.some?.status).toBe("ACCEPTED");
    expect(carrierBranch?.bids?.some?.status).toBe("ACCEPTED");
  });

  /** The point of this file: one rule, two encodings, no drift. */
  it("agrees with canExchangeContact on every row × viewer", () => {
    for (const row of rows) {
      for (const viewerId of viewers) {
        const predicate =
          row.auctionId === AUCTION &&
          canExchangeContact({
            auctionStatus: row.auctionStatus,
            shipperId: row.shipperId,
            acceptedCarrierId: row.acceptedCarrierId,
            viewerId,
          });

        expect(matchesWhere(row, viewerId), `${row.label} · viewer ${viewerId}`).toBe(predicate);
      }
    }
  });

  /**
   * Not a rule so much as the reason there is a rule: whatever the row, three
   * of these four people must see nothing, and the fourth pair must see each
   * other. Written as a sweep so a future branch added to the OR cannot widen
   * the audience without failing here.
   */
  it("never admits anyone outside the two parties, on any row", () => {
    for (const row of rows) {
      expect(matchesWhere(row, LOSER), row.label).toBe(false);
      expect(matchesWhere(row, STRANGER), row.label).toBe(false);
    }
  });
});
