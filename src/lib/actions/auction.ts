"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { resolveRoute } from "@/lib/maps";
import { AcceptBidSchema, CreateAuctionSchema, firstIssue, type ActionResult } from "@/lib/schemas";
import { tonsToKg } from "@/lib/format";

/**
 * Thrown inside `acceptBid`'s transaction when the status-guarded claim matches
 * no rows — meaning cron expired the auction, or another accept won the race.
 *
 * A class rather than a string so the `catch` can tell "someone else got there
 * first", which is ordinary, from a real database failure, which is not.
 * Throwing is what rolls the transaction back.
 */
class AuctionNoLongerActiveError extends Error {
  constructor() {
    super("Auction is no longer ACTIVE");
    this.name = "AuctionNoLongerActiveError";
  }
}

/**
 * Create an auction, resolving the driving route first
 * (TechnicalDocument.md §5.2 and §10).
 *
 * Coordinates arrive from the client's Places Autocomplete and are therefore
 * untrusted. zod range-checks them, and they are used only for the Distance
 * Matrix lookup and for display — they grant no access to anything, so a forged
 * pair costs the forger a wrong distance on their own auction and nothing more.
 */
export async function calculateRouteAndCreateAuction(
  input: unknown,
): Promise<ActionResult<{ id: string; routeWarning: string | null }>> {
  const session = await requireRole("SHIPPER");

  const parsed = CreateAuctionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const {
    pickupLocation, pickupLat, pickupLng,
    dropoffLocation, dropoffLat, dropoffLng,
    materialDetails, weightTons, durationHours,
  } = parsed.data;

  // Route lookup needs both ends geocoded. Without a Maps key the autocomplete
  // degrades to a plain text box and sends nulls — expected, not an error.
  let distanceKm: number | null = null;
  let estimatedTimeMins: number | null = null;
  let routeWarning: string | null = null;

  const haveCoordinates =
    pickupLat !== null && pickupLng !== null && dropoffLat !== null && dropoffLng !== null;

  if (haveCoordinates) {
    const route = await resolveRoute(
      { lat: pickupLat, lng: pickupLng },
      { lat: dropoffLat, lng: dropoffLng },
    );

    if (route.ok) {
      distanceKm = route.data.distanceKm;
      estimatedTimeMins = route.data.estimatedTimeMins;
    } else {
      // Deliberately non-fatal (§10.5): a load with an unknown distance is
      // worth more to a shipper than no load at all. The warning is surfaced
      // on the next screen rather than blocking the post.
      routeWarning = route.error;
    }
  }

  const auction = await prisma.auction.create({
    data: {
      shipperId: session.userId,
      pickupLocation,
      dropoffLocation,
      materialDetails,
      weightKg: tonsToKg(weightTons), // the UI collects tonnes; the schema stores kg
      endTime: new Date(Date.now() + durationHours * 60 * 60 * 1000),
      status: "ACTIVE",
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      distanceKm,
      estimatedTimeMins,
    },
    select: { id: true },
  });

  revalidatePath("/shipper");
  revalidatePath("/carrier");

  return { ok: true, data: { id: auction.id, routeWarning } };
}

/**
 * Accept a bid — the critical transaction (TechnicalDocument.md §5.4).
 *
 * The shipper accepting races the cron job expiring the same auction.
 * Read-then-write loses that race: both readers see `ACTIVE`, both proceed, and
 * the auction ends up assigned *and* expired, or a bid gets accepted on a load
 * whose deadline passed.
 *
 * The fix is a **status-guarded conditional update**. `updateMany` with
 * `status: 'ACTIVE'` in its `WHERE` is atomic — whoever flips the row first
 * wins, and the loser sees `count === 0` and aborts. Nothing is decided by
 * anything we read beforehand.
 *
 * Serializable isolation on top of that, because the three writes must be one
 * indivisible fact: an auction assigned with no accepted bid, or two accepted
 * bids, are both states the schema cannot express its way out of.
 */
export async function acceptBid(input: unknown): Promise<ActionResult> {
  const session = await requireRole("SHIPPER");

  const parsed = AcceptBidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { auctionId, bidId } = parsed.data;

  // Ownership is checked here, but it is NOT what makes the write safe — the
  // transaction's WHERE clause is. This just fails early with a better message.
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    select: { id: true, auctionId: true, auction: { select: { shipperId: true } } },
  });

  if (!bid || bid.auctionId !== auctionId) {
    return { ok: false, error: "That bid no longer exists." };
  }
  if (bid.auction.shipperId !== session.userId) {
    // Same reasoning as the detail page's 404: do not confirm what exists.
    return { ok: false, error: "That bid no longer exists." };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. CLAIM. Atomically flips ACTIVE → COMPLETED_ASSIGNED, and only if
        //    the deadline has not passed. Whoever wins this wins the race.
        const claimed = await tx.auction.updateMany({
          where: { id: auctionId, status: "ACTIVE", endTime: { gt: new Date() } },
          data: { status: "COMPLETED_ASSIGNED" },
        });

        if (claimed.count === 0) throw new AuctionNoLongerActiveError();

        // 2. The winner.
        await tx.bid.update({ where: { id: bidId }, data: { status: "ACCEPTED" } });

        // 3. Everyone else. Scoped to PENDING so a re-run cannot demote the
        //    winner, and so it stays a no-op if this somehow replays.
        await tx.bid.updateMany({
          where: { auctionId, id: { not: bidId }, status: "PENDING" },
          data: { status: "REJECTED" },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof AuctionNoLongerActiveError) {
      // Expected, not exceptional: cron got there first, or the shipper sat on
      // the confirm sheet past the deadline. The UI refreshes and shows the
      // real state rather than reporting a crash.
      return { ok: false, error: "This auction just closed." };
    }

    console.error("[acceptBid]", error);
    return { ok: false, error: "Couldn't accept that bid. Please try again." };
  }

  // A won auction changes every screen that lists it, on both sides.
  revalidatePath(`/shipper/auction/${auctionId}`);
  revalidatePath("/shipper");
  revalidatePath("/shipper/history");
  revalidatePath(`/carrier/auction/${auctionId}`);
  revalidatePath("/carrier");
  revalidatePath("/carrier/bids");

  return { ok: true, data: undefined };
}

/** Kept so callers can redirect after a successful create without duplicating the path. */
export async function goToAuction(id: string): Promise<never> {
  redirect(`/shipper/auction/${id}`);
}
