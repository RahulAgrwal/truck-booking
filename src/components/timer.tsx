"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/design/cn";
import { formatRemaining } from "@/lib/format";

import { Icon } from "./ui/icon";

/**
 * Countdown to an auction's close — the most correctness-sensitive component
 * in the app (TechnicalDocument.md §7.3).
 *
 * The formatting and the 30-minute urgency threshold live in Lane A's
 * `formatRemaining` (`src/lib/format.ts`), which is already unit-tested across
 * every boundary in §8.1. This component is the rendering and ticking half
 * only — deliberately no second copy of the maths.
 *
 * Three rules it exists to enforce:
 *
 * 1. **`endTime` is an absolute ISO instant, never a duration.** RSC payloads
 *    are cached, so a "2h 14m" computed on the server is already wrong by the
 *    time it paints.
 * 2. **Recompute from the target every tick; never decrement a counter.**
 *    Browsers throttle timers in background tabs and devices sleep — a
 *    decremented value drifts, a recomputed one self-corrects on the next tick.
 * 3. **The client's countdown is a display, not an authority.** Reaching zero
 *    renders "Expired" and refreshes; the server re-checks `endTime` on every
 *    write regardless (CLAUDE.md §3.2).
 */
export function Timer({
  endTime,
  variant = "bare",
  className,
}: {
  /** Absolute ISO 8601 instant. */
  endTime: string;
  /** `bare` = shipper card (value over a REMAINING label) · `chip` = carrier card. */
  variant?: "bare" | "chip";
  className?: string;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(() => formatRemaining(endTime));
  // The refresh at zero must fire once, not once per second afterwards.
  const refreshed = useRef(false);

  useEffect(() => {
    function tick() {
      const next = formatRemaining(endTime);
      setRemaining(next);

      if (next.expired && !refreshed.current) {
        refreshed.current = true;
        // The row may still read ACTIVE for up to 60s until cron sweeps it.
        // Harmless: §5.3 guard 4 rejects a bid on an elapsed auction anyway.
        router.refresh();
      }
    }

    /*
      The first render's value came from whatever `Date.now()` was during SSR,
      so it needs re-syncing — but on a macrotask, not synchronously in the
      effect body. A synchronous setState here cascades a second render before
      paint on every mounted Timer, which on a feed of cards is one per row;
      React's compiler lint rejects it for exactly that reason.
    */
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);

    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [endTime, router]);

  const label = remaining.expired ? "Expired" : remaining.label;
  // aria-live="off": announcing a countdown once a second is hostile. The
  // label carries the full remaining time for a single, on-demand read.
  const ariaLabel = remaining.expired ? "Auction expired" : `${remaining.label} remaining`;

  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-unit rounded px-2 py-1",
          remaining.urgent
            ? "bg-error-container text-error"
            : "bg-surface-container-high text-on-surface",
          className,
        )}
        aria-live="off"
        aria-label={ariaLabel}
      >
        <Icon name="schedule" className="text-[16px]" />
        <span className="font-timer-md text-timer-md" suppressHydrationWarning>
          {label}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn("flex flex-col items-end", className)}
      aria-live="off"
      aria-label={ariaLabel}
    >
      <span
        className={cn(
          "font-timer-md text-timer-md",
          // Colour is a reinforcement, not the signal — the digits themselves
          // already say how little time is left (§7.7).
          remaining.urgent ? "text-error" : "text-primary",
        )}
        // The server rendered against its own clock; the effect above corrects
        // this within a second. Without it React logs a mismatch on every card.
        suppressHydrationWarning
      >
        {label}
      </span>
      <span className="font-label-bold text-label-bold text-secondary uppercase">
        {remaining.expired ? "closed" : "remaining"}
      </span>
    </span>
  );
}
