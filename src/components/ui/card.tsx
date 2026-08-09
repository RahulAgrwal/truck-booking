import type { ReactNode } from "react";

import { cn } from "@/lib/design/cn";

/**
 * Card — the CLAUDE.md §4.4 recipe, with one deliberate deviation.
 *
 * Padding is `p-gutter-mobile` (12px), not the recipe's `p-stack-md` (16px).
 * The type scale was compressed for 390px (globals.css §type scale); 16px of
 * padding around the smaller text left cards reading as hollow. Screen gutters
 * and the 48px touch floor are untouched — only the card's own inset moved.
 *
 * ```
 * bg-surface-container-lowest border border-surface-variant rounded-lg p-gutter-mobile
 * shadow-[0_4px_12px_rgba(0,33,83,0.08)] active:scale-[0.98] transition-transform
 * ```
 *
 * The shadow is an arbitrary value on purpose: it is lifted from the Stitch
 * output and there is no token for it. That is the recipe, not a one-off.
 */

/** Constrained rather than fully polymorphic — these are the shapes a card takes. */
type CardElement = "div" | "article" | "section" | "li";

export function Card({
  as = "div",
  pressable = false,
  className,
  children,
}: {
  as?: CardElement;
  /**
   * Adds the press feedback. Set it only when the whole card is tappable —
   * a card that scales under the thumb but does nothing is a lie.
   */
  pressable?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Component = as;

  return (
    <Component
      className={cn(
        "bg-surface-container-lowest border border-surface-variant rounded-lg p-gutter-mobile",
        "shadow-[0_4px_12px_rgba(0,33,83,0.08)]",
        pressable && "transition-transform active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </Component>
  );
}

/**
 * The inset strip at the foot of a card — icon + meta on the left, a `Badge` on
 * the right (CLAUDE.md §4.4). Lives here because it only ever appears inside a
 * `Card` and both `AuctionCard` variants use it.
 */
export function CardMetaStrip({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-surface-container-low p-stack-sm rounded flex items-center justify-between gap-stack-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
