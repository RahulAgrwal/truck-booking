import type { ReactNode } from "react";

import { cn } from "@/lib/design/cn";

/**
 * Badge (TechnicalDocument.md §6.2) — bid counts and statuses.
 *
 * Not interactive, so the 48px floor does not apply.
 *
 * §7.7: never signal state by colour alone. A badge always carries a word or a
 * number; `tone` reinforces it, it does not replace it.
 */

export type BadgeTone = "brand" | "neutral" | "error" | "success";

const TONE: Record<BadgeTone, string> = {
  /** Bid count > 0 — the safety orange. */
  brand: "bg-primary-container text-on-primary-container",
  /** Bid count 0, or any neutral status. */
  neutral: "bg-surface-variant text-on-surface-variant",
  error: "bg-error-container text-on-error-container",
  /** ACCEPTED / "Won". */
  success: "bg-tertiary-container text-on-tertiary-container",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        "h-6 min-w-6 px-stack-sm font-label-bold text-label-bold",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The LIVE badge — a pulsing dot plus the word, per the §4.4 recipe. The word
 * is not decoration: red alone would be the colour-only signal §7.7 forbids,
 * and `animate-ping` is killed under `prefers-reduced-motion`.
 */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-stack-sm", className)}>
      <span className="relative flex h-3 w-3" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
      </span>
      <span className="font-label-bold text-label-bold text-error uppercase tracking-wider">Live</span>
    </span>
  );
}
