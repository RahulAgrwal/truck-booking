"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { SubmitBidSchema, firstIssue, type ActionResult } from "@/lib/schemas";
import { requireSession } from "@/lib/session";

/**
 * Submit a bid on an auction (TechnicalDocument.md §5.3).
 *
 * This is a **reverse** auction: carriers bid the price down, so each bid from
 * a carrier must undercut their own previous one.
 *
 * All six guards run server-side. The UI equivalents — a disabled button, a
 * countdown that says "Expired", a form that is simply not rendered — are
 * decoration; every one of them can be bypassed by calling the action
 * directly, so none of them is load-bearing (CLAUDE.md §3.2).
 */
export async function submitBid(input: unknown): Promise<ActionResult<{ amount: number }>> {
  // 1. Authenticated, and a CARRIER.
  const session = await requireSession();
  if (session.role !== "CARRIER") {
    return { ok: false, error: "Only carriers can place bids." };
  }

  // Always parse before touching the database.
  const parsed = SubmitBidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { auctionId, amount } = parsed.data;

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { id: true, shipperId: true, status: true, endTime: true },
  });

  // 2. Exists.
  if (!auction) return { ok: false, error: "That load no longer exists." };

  // 3. Still open.
  if (auction.status !== "ACTIVE") {
    return { ok: false, error: "This auction has closed." };
  }

  /*
    4. Not elapsed. THE important one: the client's countdown is a display, and
    the status column lags by up to 60s until cron sweeps it. Re-checking
    endTime here is what makes that lag harmless — a row that still reads
    ACTIVE but whose deadline has passed rejects the bid anyway.
  */
  if (auction.endTime.getTime() <= Date.now()) {
    return { ok: false, error: "This auction has expired." };
  }

  // 5. Not your own load. Belt and braces — a CARRIER cannot own an auction
  // today, but the check costs nothing and the guarantee is worth stating.
  if (auction.shipperId === session.userId) {
    return { ok: false, error: "You can't bid on your own load." };
  }

  /*
    6. Must undercut your OWN previous bid. Not the global minimum: another
    carrier being cheaper is not a reason to refuse a bid, it is the auction
    working. Bids are never deleted (§3.3), so the carrier's own lowest is the
    whole of their history here.
  */
  const previous = await prisma.bid.findFirst({
    where: { auctionId, carrierId: session.userId },
    orderBy: { amount: "asc" },
    select: { amount: true },
  });

  if (previous && amount >= previous.amount) {
    return {
      ok: false,
      field: "amount",
      error: `Your bid must be lower than your current bid of ₹${previous.amount.toLocaleString("en-IN")}.`,
    };
  }

  await prisma.bid.create({
    data: {
      auctionId,
      carrierId: session.userId,
      amount,
      status: "PENDING",
    },
  });

  // A new bid changes the carrier's view, the shipper's view, and both feeds.
  revalidatePath(`/carrier/auction/${auctionId}`);
  revalidatePath(`/shipper/auction/${auctionId}`);
  revalidatePath("/carrier/bids");
  revalidatePath("/carrier");
  revalidatePath("/shipper");

  return { ok: true, data: { amount } };
}
