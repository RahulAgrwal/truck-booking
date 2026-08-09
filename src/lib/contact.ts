import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AuctionStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

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
 * The one select of the sensitive columns.
 *
 * `role` is deliberately **not** selected. The column is nullable (it stays
 * null until onboarding), but the role that matters on a contact card is the
 * one this person played in *this deal* — shipper or winning carrier — which
 * is a fact about their position in the query, not about a column that could
 * in principle disagree with it. Deriving it removes a null case that had no
 * sensible answer.
 */
const dealPartySelect = {
  id: true,
  name: true,
  profileImage: true,
  phone: true,
  address: true,
  companyName: true,
  truckNumber: true,
  truckType: true,
  ratingSum: true,
  ratingCount: true,
} satisfies Prisma.UserSelect;

type DealPartyRow = Prisma.UserGetPayload<{ select: typeof dealPartySelect }>;

function toDealParty(row: DealPartyRow, role: Role): DealParty {
  return {
    userId: row.id,
    name: row.name,
    profileImage: row.profileImage,
    role,
    phone: row.phone,
    address: row.address,
    companyName: row.companyName,
    truckNumber: row.truckNumber,
    truckType: row.truckType,
    ratingSum: row.ratingSum,
    ratingCount: row.ratingCount,
  };
}

/**
 * The contact card's entire data source, or `null` when Rule 1 says no.
 *
 * `null` means "render nothing" — never a placeholder, never a locked-looking
 * card. A screen that draws "contact details hidden" has told a losing carrier
 * that a winner exists, which is exactly the fact the rule is protecting.
 *
 * One round trip. The `where` is `dealWhere`, so the row simply does not come
 * back for anyone the rule excludes — the filtering is the query, not a check
 * on data we already fetched. That ordering is the point: an unauthorised
 * caller never has the phone number in memory to begin with.
 */
export async function getDeal(auctionId: string, viewerId: string): Promise<Deal | null> {
  const auction = await prisma.auction.findFirst({
    where: dealWhere(auctionId, viewerId),
    select: {
      id: true,
      shipper: { select: dealPartySelect },
      // At most one — `acceptBid` accepts a single bid and rejects the rest.
      bids: {
        where: { status: "ACCEPTED" },
        select: { amount: true, carrier: { select: dealPartySelect } },
        take: 1,
      },
      // The @@unique([auctionId, authorId]) index, used as an existence check.
      reviews: { where: { authorId: viewerId }, select: { id: true }, take: 1 },
    },
  });

  if (!auction) return null;

  const accepted = auction.bids[0];
  // Unreachable through `dealWhere`, which requires an ACCEPTED bid in both
  // branches. Kept because the alternative to a null check here is a crash on
  // a contact card, and because it keeps this function correct on its own
  // terms rather than only in combination with its `where`.
  if (!accepted) return null;

  const shipper = auction.shipper;
  const carrier = accepted.carrier;

  const viewerIsShipper = shipper.id === viewerId;
  if (!viewerIsShipper && carrier.id !== viewerId) return null;

  const shipperParty = toDealParty(shipper, "SHIPPER");
  const carrierParty = toDealParty(carrier, "CARRIER");

  return {
    auctionId: auction.id,
    amount: accepted.amount,
    me: viewerIsShipper ? shipperParty : carrierParty,
    them: viewerIsShipper ? carrierParty : shipperParty,
    iReviewed: auction.reviews.length > 0,
  };
}
