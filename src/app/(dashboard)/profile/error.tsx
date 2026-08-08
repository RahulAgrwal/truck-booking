"use client";

import { useEffect } from "react";

import { AppScreen, TopAppBar } from "@/components/app-shell";
import { ErrorState } from "@/components/ui/empty-state";

/**
 * Profile error boundary (§7.5). No nav, for the same reason as `loading.tsx`
 * — the role never resolved, so there is nothing to draw the right tabs from.
 */
export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[profile]", error);
  }, [error]);

  return (
    <>
      <TopAppBar title="Profile" />

      <AppScreen>
        <ErrorState
          title="Couldn't load your profile"
          body="You're still signed in — this screen just didn't load. Try again."
          onRetry={reset}
        />
      </AppScreen>
    </>
  );
}
