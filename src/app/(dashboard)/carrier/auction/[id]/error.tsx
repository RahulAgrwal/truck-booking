"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ErrorState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";

/**
 * Place-a-bid error boundary (§7.5).
 *
 * Note what this does *not* claim: it never says the bid failed. This boundary
 * catches render-time failures on the page, and `submitBid`'s own rejections
 * come back through `ActionResult` as inline messages on the form — they never
 * reach here. Telling someone their bid failed when it may have been written
 * would be worse than saying nothing.
 */
export default function PlaceBidError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[place bid]", error);
  }, [error]);

  return (
    <>
      <header className="relative flex h-touch-target-min w-full shrink-0 items-center justify-center bg-surface px-margin-mobile pt-safe">
        <Link
          href="/carrier"
          aria-label="Back to load feed"
          className="absolute left-margin-mobile flex h-touch-target-min w-touch-target-min items-center justify-center rounded-full text-on-surface active:opacity-80"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="font-headline-md text-headline-md text-on-surface">Submit Bid</h1>
      </header>

      <main className="flex-1 px-margin-mobile pt-stack-lg">
        <ErrorState
          title="Couldn't load this load"
          body="The details didn't come back, so there's nothing to bid on yet. Try again."
          onRetry={reset}
        />
      </main>
    </>
  );
}
