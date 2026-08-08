"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/empty-state";

/**
 * The app-wide error boundary (§7.5).
 *
 * Routes that own a nearer `error.tsx` — the three carrier screens and profile
 * — never reach this. It exists for everything else: `/`, `/login`,
 * `/onboarding`, `/shipper/create`, and any future route that ships without its
 * own boundary. Before it existed, those fell through to Next's default error
 * page, which is the raw stack §7.5 explicitly forbids.
 *
 * No chrome: an error this far up may be *from* the chrome, and a top bar that
 * throws while rendering the error page produces a blank screen instead of a
 * message.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-margin-mobile pt-safe pb-safe">
      <ErrorState
        title="Something went wrong"
        body="That didn't load. It's usually temporary — try again."
        onRetry={reset}
      />
    </main>
  );
}
