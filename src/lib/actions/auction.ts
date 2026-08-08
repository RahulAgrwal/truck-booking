"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { resolveRoute } from "@/lib/maps";
import { CreateAuctionSchema, firstIssue, type ActionResult } from "@/lib/schemas";
import { tonsToKg } from "@/lib/format";

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
 * Accept a bid — implemented in A6 (TechnicalDocument.md §5.4).
 *
 * Deliberately not stubbed with a fake success: it must be a status-guarded
 * transaction, and a placeholder that "works" is worse than an absent one.
 *
 * A5 widened the signature to the real one so the accept sheet could be built
 * against it. The body is still the honest refusal — the UI renders the button
 * and the confirm sheet, and pressing through shows this message until A6
 * lands.
 */
export async function acceptBid(_input: unknown): Promise<ActionResult> {
  return { ok: false, error: "Accepting bids is not available yet." };
}

/** Kept so callers can redirect after a successful create without duplicating the path. */
export async function goToAuction(id: string): Promise<never> {
  redirect(`/shipper/auction/${id}`);
}
