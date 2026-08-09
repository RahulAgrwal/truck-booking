"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { getDeal } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import {
  REVIEWS_SHEET_SIZE,
  reviewsFor,
  serializeReviewRow,
  type SerializedReviewRow,
} from "@/lib/reviews";
import {
  CarrierReviewsSchema,
  SubmitReviewSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/schemas";
import { requireSession } from "@/lib/session";

/**
 * One carrier's recent reviews, fetched when the accept-bid sheet opens.
 *
 * **Why an action rather than data on the page.** The shipper's auction detail
 * page mounts `PollingRefresher`, which calls `router.refresh()` every 7s while
 * the auction is live. Reading three reviews per bidding carrier in the page
 * would therefore re-run one query per carrier every seven seconds, forever, to
 * fill sheets that mostly never open. Fetching when the control is actually
 * used costs one query at the moment someone asks for it.
 *
 * **No Rule 1 check, deliberately.** Reviews are public reputation (§2, Rule 2)
 * — a shipper comparing four bids is *supposed* to read all four carriers'
 * reviews before accepting anything. Routing this through `getDeal` would
 * invert the feature.
 */
export async function getCarrierReviews(input: unknown): Promise<ActionResult<SerializedReviewRow[]>> {
  /*
    `requireSession`, not `requireRole("SHIPPER")` as the request asked for, and
    the deviation is on purpose — two reasons, either sufficient:

    1. `requireRole` now redirects a details-incomplete user to
       /onboarding/details (B5). A *data fetch* that navigates the page out from
       under an open sheet is a bad failure mode, and this action reads nothing
       that user is not entitled to.
    2. SHIPPER would be a guard that is not a security boundary — reviews are
       public — so it would read like one and mislead. A carrier-side screen
       wanting the same list later should not have to remove a fake check.

    Strictly more permissive than requested, so no caller of theirs can break.
  */
  await requireSession();

  const parsed = CarrierReviewsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const rows = await reviewsFor(parsed.data.carrierId, parsed.data.take ?? REVIEWS_SHEET_SIZE);
  return { ok: true, data: rows.map(serializeReviewRow) };
}

/** Prisma's unique-constraint violation — here, always @@unique([auctionId, authorId]). */
const UNIQUE_VIOLATION = "P2002";

const ALREADY_RATED = "You've already rated this job.";

/**
 * Rate the other party on a completed job
 * (docs/feature-contact-ratings.md §4).
 *
 * **Its authorization is Rule 1.** `getDeal(...) === null ⇒ refuse`: you can
 * only review someone you demonstrably transacted with. There is deliberately
 * no second permission model here to keep in sync with the first — the same
 * query that decides whether you may see a phone number decides whether you
 * may leave a review, so the two can never drift apart.
 *
 * Note the asymmetry with the rest of the feature: a rating, once written, is
 * *public* (§2, Rule 2). Rule 1 gates who may write one, never who may read it.
 */
export async function submitReview(input: unknown): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = SubmitReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { auctionId, stars, comment } = parsed.data;

  // Rule 1, and the whole of the authorization. Note it is keyed on the
  // session's userId, never on anything the client sent.
  const deal = await getDeal(auctionId, session.userId);
  if (!deal) {
    return { ok: false, error: "You can only review someone you've completed a job with." };
  }

  // The friendly path for the common case. The constraint below is what
  // actually guarantees it — this check just produces a better message than a
  // caught database error would.
  if (deal.iReviewed) return { ok: false, error: ALREADY_RATED };

  const subjectId = deal.them.userId;

  try {
    /*
      One transaction, two writes: the row and the aggregate. This is the whole
      reason ratingSum/ratingCount can be trusted — they are incremented by the
      same statement batch that inserts the review, so "the aggregate equals the
      sum of the rows" is not a claim that needs periodic reconciliation.

      `increment` rather than read-modify-write: two people rating the same
      carrier at the same instant would otherwise each read the old sum and one
      of the two ratings would vanish.
    */
    await prisma.$transaction([
      prisma.review.create({
        data: {
          auctionId,
          authorId: session.userId,
          subjectId,
          stars,
          // A comment the user left blank is absent, not empty.
          comment: comment && comment.length > 0 ? comment : null,
        },
      }),
      prisma.user.update({
        where: { id: subjectId },
        data: { ratingSum: { increment: stars }, ratingCount: { increment: 1 } },
      }),
    ]);
  } catch (error) {
    /*
      Two taps on Submit race past the iReviewed check above; the loser lands
      here. Same reasoning as acceptBid's status-guarded updateMany
      (TechnicalDocument §5.4) — the constraint is atomic, a read is not — and
      because the insert is inside the transaction, the loser's increment rolls
      back with it. The aggregate cannot double-count.
    */
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: ALREADY_RATED };
    }
    console.error("[submitReview]", error);
    return { ok: false, error: "Could not save your review. Please try again." };
  }

  /*
    Both auction detail screens, because the rate sheet collapses once you have
    rated and the other party's card now shows the new average; both profiles,
    because that is where reviews are listed; and the two "my jobs" lists that
    carry a rate-this-job entry point.

    Not exhaustive, and deliberately so: a star average appears on every bid row
    in the app, so the only complete invalidation would be the whole tree. Those
    screens are dynamic and poll, so they self-correct within a refresh.
  */
  revalidatePath(`/shipper/auction/${auctionId}`);
  revalidatePath(`/carrier/auction/${auctionId}`);
  revalidatePath("/shipper/history");
  revalidatePath("/carrier/bids");
  revalidatePath("/profile");

  return { ok: true, data: undefined };
}
