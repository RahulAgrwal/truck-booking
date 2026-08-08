import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { expiredAuctionWhere } from "@/lib/auction-close";
import { prisma } from "@/lib/prisma";

/**
 * Auction expiry sweep (TechnicalDocument.md §5.5).
 *
 * Called by Cloud Scheduler, not by the app — see `docs/cloud-scheduler.md`.
 * It is the **only** route middleware lets through without a session, which is
 * why the bearer check below is the entire security boundary for it.
 *
 * Never cached: a cached sweep is a sweep that did not happen.
 */
export const dynamic = "force-dynamic";
// Node runtime, not Edge: node:crypto and Prisma both need it.
export const runtime = "nodejs";

/**
 * Constant-time bearer comparison.
 *
 * `a === b` on a secret leaks its length and its matching prefix through timing.
 * `timingSafeEqual` requires equal-length buffers, so the length check happens
 * first and deliberately returns early — that leak is unavoidable with this
 * primitive, and length alone is not the secret.
 */
function isAuthorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;

  // An unset secret must fail closed. Without this, a missing env var would
  // turn the endpoint into an open "close everything" button.
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set — refusing every request.");
    return false;
  }

  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

async function sweep() {
  /*
    Idempotent and concurrency-safe by construction: the WHERE clause is the
    whole decision, so a second run matches nothing and returns 0. It cannot
    touch a COMPLETED_ASSIGNED auction either — that row is no longer ACTIVE,
    so `acceptBid` and this can never both claim the same auction.

    Bids are deliberately left PENDING. Nobody won an expired auction, and
    marking them REJECTED would claim a decision was made (§5.5).
  */
  const { count } = await prisma.auction.updateMany({
    // Shared with `shouldClose`, which is unit-tested — see auction-close.ts.
    where: expiredAuctionWhere(),
    data: { status: "CLOSED_EXPIRED" },
  });

  return NextResponse.json({ closed: count });
}

export async function POST(request: NextRequest) {
  if (!isAuthorised(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sweep();
}

/**
 * GET behaves identically. Cloud Scheduler is configured for POST, but its
 * retry and manual "force run" paths have been known to issue GET, and a sweep
 * is idempotent — so accepting both costs nothing and avoids a silent 405 that
 * would look like the schedule working.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sweep();
}
