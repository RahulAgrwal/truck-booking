import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { formatINR } from "@/lib/format";

/**
 * Stitch `16fc1711669148ceac2c4d7f91f79014` — Bid Confirmation Success.
 *
 * §7.6: a screen that has just committed something irreversible shows a
 * success *screen*, not a toast. The chrome is suppressed — no app bar, no
 * bottom nav — because there is exactly one thing to do next.
 *
 * The mockup's SVG hard-codes three PRD-palette hexes — the emerald, the old
 * orange and the navy — all superseded, and all caught by the grep in B0's
 * accept criteria (CLAUDE.md §3.3; the values are deliberately not repeated
 * here, or this comment would fail that grep itself). Redrawn against
 * `currentColor` and the tokens, so the mark inherits `text-tertiary` rather
 * than pinning a green. The confetti is dropped: it existed only to carry
 * those three colours.
 */
export function BidSuccess({
  amount,
  pickupLocation,
  dropoffLocation,
}: {
  amount: number;
  pickupLocation: string;
  dropoffLocation: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-margin-mobile pt-safe pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
      <div className="flex w-full flex-col items-center text-center">
        <SuccessMark />

        <h1 className="mb-stack-sm font-headline-lg text-headline-lg tracking-tight text-on-surface">
          Bid Submitted!
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Your bid of <span className="font-headline-md text-on-surface">{formatINR(amount)}</span>{" "}
          has been placed. You&apos;ll be notified if the shipper accepts.
        </p>

        <div className="mt-stack-lg flex w-full items-center justify-between gap-stack-sm rounded-lg border border-surface-variant bg-surface-container-lowest p-gutter-mobile">
          <div className="flex min-w-0 items-center gap-2">
            <Icon name="local_shipping" filled className="text-primary" />
            <div className="min-w-0 text-left">
              <p className="font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
                Route
              </p>
              <p className="truncate font-body-md text-body-md text-on-surface">
                {pickupLocation} → {dropoffLocation}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-surface-variant bg-surface px-margin-mobile pt-stack-sm pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="pb-stack-md">
          <Link
            href="/carrier"
            className="flex h-14 w-full items-center justify-center rounded-lg bg-primary-container font-headline-md text-headline-md text-on-primary-container transition-transform active:scale-[0.98]"
          >
            Back to Load Feed
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * The drawn tick. `stroke-dasharray`/`dashoffset` animation, which
 * `prefers-reduced-motion` collapses to an instant draw via globals.css rather
 * than leaving a half-drawn mark.
 */
function SuccessMark() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="mb-stack-lg h-[150px] w-[150px] text-tertiary"
      role="img"
      aria-label="Bid submitted"
    >
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="[stroke-dasharray:300] [stroke-dashoffset:300] animate-[draw-mark_0.8s_cubic-bezier(0.65,0,0.45,1)_forwards]"
      />
      <path
        d="M30 52l15 15 25-30"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="[stroke-dasharray:100] [stroke-dashoffset:100] animate-[draw-mark_0.6s_cubic-bezier(0.65,0,0.45,1)_forwards]"
      />
    </svg>
  );
}
