import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AuctionStatus, Role } from "@/generated/prisma/enums";

/**
 * Rule 1 — contact visibility (docs/feature-contact-ratings.md §2), and the
 * only place in the codebase that may select a sensitive column.
 *
 * > X's contact details are visible to Y **iff** there exists an auction A with
 * > `A.status = COMPLETED_ASSIGNED`, holding a bid B with `B.status = ACCEPTED`,
 * > where `{A.shipperId, B.carrierId} = {X, Y}`.
 *
 * `phone`, `address`, `companyName`, `truckNumber` and `truckType` are selected
 * here and nowhere else. That, not a code review, is the enforcement: a page
 * cannot leak a phone number it never queried.
 *
 * Ratings are **not** covered by this rule and must never be routed through it
 * (§2, Rule 2) — a star average is public reputation, visible before anyone has
 * accepted anything. Conflating the two is the one way this feature leaks.
 *
 * Structure mirrors `src/lib/auction-close.ts`: the real predicate lives in a
 * Prisma `WHERE` that no unit test can execute, so both forms are written from
 * one statement of the rule and `contact.test.ts` asserts they agree case for
 * case. Change one and the test fails on the other.
 */

/**
 * The `WHERE` half of Rule 1.
 *
 * Both branches require an `ACCEPTED` bid to exist, not just the status column:
 * a shipper needs a counterparty before there is anything to exchange, and an
 * auction can only be `COMPLETED_ASSIGNED` because a bid was accepted. Trusting
 * the status alone would hand out contact details on a row someone had flipped
 * by hand.
 */
export function dealWhere(auctionId: string, viewerId: string): Prisma.AuctionWhereInput {
  return {
    id: auctionId,
    status: "COMPLETED_ASSIGNED",
    OR: [
      // The shipper who ran the auction.
      { shipperId: viewerId, bids: { some: { status: "ACCEPTED" } } },
      // The carrier whose bid won it.
      { bids: { some: { status: "ACCEPTED", carrierId: viewerId } } },
    ],
  };
}

/** The same rule as a predicate — for tests, and for any in-memory check. */
export function canExchangeContact(facts: {
  auctionStatus: AuctionStatus;
  shipperId: string;
  acceptedCarrierId: string | null;
  viewerId: string;
}): boolean {
  // An expired auction reveals nothing: nobody won it.
  if (facts.auctionStatus !== "COMPLETED_ASSIGNED") return false;
  // No accepted bid means no counterparty, whatever the status column says.
  if (facts.acceptedCarrierId === null) return false;
  // Symmetric by construction: exactly these two people, nobody else.
  return facts.viewerId === facts.shipperId || facts.viewerId === facts.acceptedCarrierId;
}

/** One side of a completed deal. Sensitive columns appear in this type only. */
export type DealParty = {
  userId: string;
  name: string;
  profileImage: string | null;
  role: Role;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  truckNumber: string | null;
  truckType: string | null;
  ratingSum: number;
  ratingCount: number;
};

export type Deal = {
  auctionId: string;
  /** The accepted bid's amount — the agreed price. */
  amount: number;
  me: DealParty;
  them: DealParty;
  /** Has the viewer already rated? Drives the rate-sheet collapse. */
  iReviewed: boolean;
};

/**
 * The contact card's entire data source, or `null` when Rule 1 says no.
 *
 * `null` means "render nothing" — never a placeholder, never a locked-looking
 * card. A screen that draws "contact details hidden" has told a losing carrier
 * that a winner exists, which is exactly the fact the rule is protecting.
 *
 * STUB — `B3` implements the query. Returning `null` is the fail-closed
 * default, so the intermediate state cannot leak anything.
 */
export async function getDeal(auctionId: string, viewerId: string): Promise<Deal | null> {
  void auctionId;
  void viewerId;
  return null;
}
