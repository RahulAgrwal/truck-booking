"use client";

import { useEffect } from "react";

import { AppScreen, NotificationBell, TopAppBar, Wordmark } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { ErrorState } from "@/components/ui/empty-state";

/**
 * Auction-details error boundary (§7.5).
 *
 * Says nothing about the auction's state, deliberately. A failure to render
 * this page tells us nothing about whether it is still running or who is
 * winning, and guessing would be worse than admitting the screen did not load.
 * `notFound()` is a separate path and lands on `not-found.tsx`.
 */
export default function ShipperAuctionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[shipper auction]", error);
  }, [error]);

  return (
    <>
      <TopAppBar title={<Wordmark />} trailing={<NotificationBell />} />

      <AppScreen>
        <ErrorState
          title="Couldn't load this auction"
          body="Your auction and its bids are safe — this screen just didn't load. Try again."
          onRetry={reset}
        />
      </AppScreen>

      <MobileNav role="SHIPPER" />
    </>
  );
}
