import { cn } from "@/lib/design/cn";

/**
 * A star rating, read-only.
 *
 * Deliberately **prop-driven** — it takes `average` and `count` and imports
 * nothing from `src/lib/reviews.ts`. A presentational component that reaches
 * into a server read model cannot be rendered from a client component, and this
 * one has to be: it appears inside the accept-bid sheet, which is `"use client"`.
 * Plain props keep it renderable from either side.
 *
 * §7.7 — colour never carries the meaning alone. The number is printed beside
 * the stars, and the whole thing has an accessible name that reads as a
 * sentence, because five glyphs are noise to a screen reader.
 */

export type StarState = "full" | "half" | "empty";

/**
 * Five star states for an average, rounded to the nearest half.
 *
 * Lives here rather than in `src/lib/reviews.ts` because it is presentation:
 * how many pixels of star to paint is not a fact about the data. `4.8` is the
 * fact; "five filled stars" is a rendering of it.
 *
 * Boundaries: a star is full from `i - 0.25`, half from `i - 0.75`. So 4.8 → 5
 * full, 4.5 → 4 full + 1 half, 4.3 → 4 full + 1 half, 4.2 → 4 full + 1 empty.
 */
export function starBreakdown(average: number | null): StarState[] {
  if (average === null) return ["empty", "empty", "empty", "empty", "empty"];

  return [1, 2, 3, 4, 5].map((position) => {
    if (average >= position - 0.25) return "full";
    if (average >= position - 0.75) return "half";
    return "empty";
  });
}

/** Glyph and fill for each state. `star_half` is already a half-filled shape. */
const GLYPH: Record<StarState, { name: string; filled: boolean }> = {
  full: { name: "star", filled: true },
  half: { name: "star_half", filled: true },
  empty: { name: "star", filled: false },
};

const SIZE = {
  sm: "text-icon-md",
  md: "text-icon-lg",
  lg: "text-icon-xl",
} as const;

export type RatingStarsSize = keyof typeof SIZE;

export function RatingStars({
  average,
  count,
  size = "sm",
  /** Hide the "(12)" — for a row that prints the count itself. */
  showCount = true,
  className,
}: {
  /** `null` when nobody has rated yet. Never pass 0 for "no ratings". */
  average: number | null;
  count: number;
  size?: RatingStarsSize;
  showCount?: boolean;
  className?: string;
}) {
  /*
    No stars at all when there is nothing to show. Five empty stars read as a
    zero-star rating, which is a claim about the carrier we have no basis for —
    "unrated" and "rated badly" are not the same fact.
  */
  if (average === null || count === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-body-md text-body-md text-on-surface-variant",
          className,
        )}
      >
        <span
          className={cn("material-symbols-outlined text-outline-variant", SIZE[size])}
          style={{ fontVariationSettings: "'FILL' 0" }}
          aria-hidden="true"
        >
          star
        </span>
        No ratings yet
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="img"
      aria-label={`${average.toFixed(1)} out of 5, ${count} ${count === 1 ? "rating" : "ratings"}`}
    >
      <span className="inline-flex items-center" aria-hidden="true">
        {starBreakdown(average).map((state, index) => (
          <span
            key={index}
            className={cn(
              "material-symbols-outlined",
              SIZE[size],
              state === "empty" ? "text-outline-variant" : "text-primary",
            )}
            style={{ fontVariationSettings: `'FILL' ${GLYPH[state].filled ? 1 : 0}` }}
          >
            {GLYPH[state].name}
          </span>
        ))}
      </span>

      <span
        className="font-label-bold text-label-bold text-on-surface tabular-nums"
        aria-hidden="true"
      >
        {average.toFixed(1)}
      </span>

      {showCount ? (
        <span
          className="font-body-md text-body-md text-on-surface-variant tabular-nums"
          aria-hidden="true"
        >
          ({count})
        </span>
      ) : null}
    </span>
  );
}
