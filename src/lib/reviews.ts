import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { formatRating, ratingAverage } from "@/lib/format";

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

/** How many reviews a profile shows before "see all" would be needed. */
export const REVIEWS_PAGE_SIZE = 5;

/**
 * Reviews *received* by `userId`, newest first.
 *
 * STUB — `B6` implements the read. It returns an empty list rather than
 * throwing so Lane A can build and render the empty state against it, which is
 * a state the real function will produce constantly anyway.
 */
export async function reviewsFor(userId: string, take: number = REVIEWS_PAGE_SIZE): Promise<ReviewRow[]> {
  void userId;
  void take;
  return [];
}
