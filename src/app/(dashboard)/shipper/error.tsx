"use client";

import { useEffect } from "react";

import { AppScreen } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { ErrorState } from "@/components/ui/empty-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack, which Next
    // deliberately withholds from the client.
    console.error("[shipper dashboard]", error);
  }, [error]);

  return (
    <>
      <AppScreen hasAppBar={false}>
        <ErrorState
          title="Couldn't load your auctions"
          body="Something went wrong on our side. Your auctions are safe — try again."
        />
        <button
          type="button"
          onClick={reset}
          className="h-touch-target-min w-full rounded-lg bg-primary-container font-headline-md text-headline-md text-on-primary-container active:scale-95 transition-transform"
        >
          Try again
        </button>
      </AppScreen>
      <MobileNav role="SHIPPER" />
    </>
  );
}
