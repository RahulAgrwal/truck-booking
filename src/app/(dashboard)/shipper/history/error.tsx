"use client";

import { useEffect } from "react";

import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { ErrorState } from "@/components/ui/empty-state";

/**
 * History error boundary. Beyond A7's file list, which names only `page` and
 * `loading`, but §7.5 requires an error state on every list — and without one
 * a failure falls through to the root boundary and loses the nav.
 */
export default function ShipperHistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[shipper history]", error);
  }, [error]);

  return (
    <>
      <TopAppBar title="History" />

      <AppScreen>
        <ErrorState
          title="Couldn't load your history"
          body="Your past loads are safe — this screen just didn't load. Try again."
          onRetry={reset}
        />
      </AppScreen>

      <MobileNav role="SHIPPER" />
    </>
  );
}
