import { cn } from "@/lib/design/cn";
import { formatRelativeTime } from "@/lib/format";

import { RatingStars } from "./rating-stars";

/**
 * A carrier's reputation, expanded — the block the shipper reads at the moment
 * of deciding, inside the accept-bid sheet.
 *
 * Accepting is the most irreversible action in the app (§3.2 has no arrow back
 * out of `COMPLETED_ASSIGNED`), and until now the sheet showed a name and a
 * price. A score with nothing behind it is barely better: "4.8" does not say
 * whether the last carrier turned up late. So the three most recent comments
 * come with it.
 *
 * Prop-driven and free of server imports, because the sheet it lives in is
 * `"use client"`. Dates arrive as absolute ISO strings (CLAUDE.md §6) — a
 * precomputed "2 days ago" goes stale inside a cached RSC payload.
 */

export type ReviewSummary = {
  id: string;
  stars: number;
  comment: string | null;
  /** Absolute ISO instant. */
  createdAt: string;
  authorName: string;
};

export function CarrierReputation({
  average,
  count,
  reviews,
  showSummary = true,
  className,
}: {
  /** `null` when nobody has rated this carrier yet. */
  average: number | null;
  count: number;
  /** Newest first, already capped by the caller. May be empty. */
  reviews: ReviewSummary[];
  /**
   * Draw the "Carrier rating ★★★★☆" line.
   *
   * `false` where the caller already shows the score — the accept sheet puts
   * it in its summary box, beside the price, and prints it the instant the
   * sheet opens rather than waiting on the comment fetch. Repeating it here
   * would be the same number twice, arriving at two different times.
   */
  showSummary?: boolean;
  className?: string;
}) {
  const withComment = reviews.filter((review) => review.comment !== null);

  return (
    <section className={cn("flex flex-col gap-stack-sm", className)}>
      {showSummary ? (
        <div className="flex items-center justify-between gap-stack-sm">
          <span className="font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
            Carrier rating
          </span>
          <RatingStars average={average} count={count} size="md" />
        </div>
      ) : null}

      {/*
        Not an error state and not an empty list to apologise for — a new
        carrier has no history, and saying so plainly is the honest version of
        showing five grey stars.
      */}
      {average === null ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          This carrier hasn&apos;t completed a job through TruckingGO yet.
        </p>
      ) : withComment.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          {count === 1 ? "1 shipper has" : `${count} shippers have`} rated this carrier, without
          leaving a comment.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-stack-sm p-0">
          {withComment.map((review) => (
            <li
              key={review.id}
              className="flex flex-col gap-unit rounded bg-surface-container-low p-3"
            >
              <div className="flex items-center justify-between gap-stack-sm">
                <RatingStars average={review.stars} count={1} showCount={false} />
                <span className="shrink-0 font-body-md text-body-md text-on-surface-variant">
                  {formatRelativeTime(review.createdAt)}
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface">{review.comment}</p>
              <p className="font-label-bold text-label-bold text-on-surface-variant">
                — {review.authorName}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
