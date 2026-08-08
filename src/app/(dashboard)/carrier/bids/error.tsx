"use client";

import { useEffect } from "react";

import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { ErrorState } from "@/components/ui/empty-state";

/**
 * My Bids error boundary.
 *
 * BuildPlan `B5` lists only `page.tsx` and `loading.tsx`, but §7.5 requires
 * loading, empty *and* error on every list screen — and a failed load here
 * would otherwise fall through to the root boundary and lose the nav.
 */
export default function MyBidsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[my bids]", error);
  }, [error]);

  return (
    <>
      <TopAppBar title="My Bids" />

      <AppScreen>
        <ErrorState
          title="Couldn't load your bids"
          body="Your bids are safe — this screen just didn't load. Try again."
          onRetry={reset}
        />
      </AppScreen>

      <MobileNav role="CARRIER" />
    </>
  );
}
