"use client";

import { useEffect } from "react";

import { AppScreen, NotificationBell, TopAppBar, Wordmark } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { ErrorState } from "@/components/ui/empty-state";

/**
 * Carrier feed error boundary (§7.5).
 *
 * An `error.tsx` is always a Client Component — React needs `reset` to be
 * callable from the browser.
 *
 * The user gets a plain sentence and a retry, never the stack: `error.message`
 * from a Server Component is a digest in production anyway, and in development
 * it can carry query text. The real detail goes to the console.
 */
export default function CarrierFeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[carrier feed]", error);
  }, [error]);

  return (
    <>
      {/*
        No `leading` avatar: there is no session to draw one from, and a pulsing
        placeholder on a screen that has finished — in failure — would claim
        something is still on its way. The wordmark and bell are the page's own.
      */}
      <TopAppBar title={<Wordmark />} trailing={<NotificationBell />} />

      <AppScreen>
        <ErrorState
          title="Couldn't load the feed"
          body="The load list didn't come back. It's usually temporary — try again."
          onRetry={reset}
        />
      </AppScreen>

      <MobileNav role="CARRIER" />
    </>
  );
}
