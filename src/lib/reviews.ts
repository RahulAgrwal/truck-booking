import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { formatRating, ratingAverage } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * The ratings read model (docs/feature-contact-ratings.md §4).
 *
 * Everything a screen needs to show reputation, so that **no Prisma select for
 * ratings is ever written inside `src/app/`**. That is not a leak rule — star
 * averages are public (§2, Rule 2) — it is a consistency rule: one definition
 * of "what a rater looks like" means every screen shows the same thing.
 *
 * **This module is `server-only`.** It holds Prisma reads, so importing it
 * from a client component is a build error. The two pure helpers below are
 * therefore *defined* in `@/lib/format` and only re-exported here: a client
 * component that needs `formatRating` imports it from there. Both paths are
 * the same function; the contract in §4 holds either way.
 */
export { formatRating, ratingAverage };

/**
 * The shape of "someone whose reputation we are showing" — a bid's carrier, an
 * auction's shipper, the other party on a contact card.
 *
 * `ratingSum` + `ratingCount` rather than a precomputed average, so the caller
 * decides between "4.8 (12)" and five painted stars without a second query.
 */
export const raterSelect = {
  id: true,
  name: true,
  profileImage: true,
  ratingSum: true,
  ratingCount: true,
} satisfies Prisma.UserSelect;

export type Rater = Prisma.UserGetPayload<{ select: typeof raterSelect }>;

/** One review as a screen renders it — author flattened, no nested include. */
export type ReviewRow = {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: Date;
  authorName: string;
  authorImage: string | null;
};

/**
 * The same row with `createdAt` as an absolute ISO string.
 *
 * What crosses a Server Action boundary into a client component, per
 * CLAUDE.md §6: never a precomputed "3 days ago", because RSC payloads are
 * cached and a relative string goes stale in them; and a string rather than a
 * `Date` so the value is inert on the way through.
 *
 * Import it with `import type` — this module is `server-only`.
 */
export type SerializedReviewRow = Omit<ReviewRow, "createdAt"> & { createdAt: string };

export function serializeReviewRow(row: ReviewRow): SerializedReviewRow {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/** How many reviews a profile shows before "see all" would be needed. */
export const REVIEWS_PAGE_SIZE = 5;

/**
 * How many the accept-bid sheet shows. Smaller than a profile's page: the
 * shipper is mid-decision with four bids in front of them, not reading a
 * carrier's history.
 */
export const REVIEWS_SHEET_SIZE = 3;

/**
 * Reviews *received* by `userId`, newest first.
 *
 * Rides the `@@index([subjectId, createdAt])` exactly: same column order, same
 * direction, so this is an index scan rather than a sort over everything the
 * user has ever been sent.
 *
 * **Not gated by Rule 1, and that is the point** (§2, Rule 2). A shipper
 * deciding between four bids can read every one of those carriers' reviews
 * before accepting anything — reputation is public, contact details are not.
 * If a caller ever needs this behind a permission check, the check belongs at
 * the caller, never here.
 *
 * The author is flattened rather than returned as a nested `include`, so
 * callers cannot accidentally hand a whole `User` row to a client component.
 */
export async function reviewsFor(userId: string, take: number = REVIEWS_PAGE_SIZE): Promise<ReviewRow[]> {
  const rows = await prisma.review.findMany({
    where: { subjectId: userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      stars: true,
      comment: true,
      createdAt: true,
      author: { select: { name: true, profileImage: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    stars: row.stars,
    comment: row.comment,
    createdAt: row.createdAt,
    authorName: row.author.name,
    authorImage: row.author.profileImage,
  }));
}
