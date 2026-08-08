"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { POLL_INTERVAL_MS } from "@/lib/design/tokens";

/**
 * Keeps a live auction screen fresh by calling `router.refresh()` on an
 * interval (TechnicalDocument.md §7.4).
 *
 * Polling rather than websockets, deliberately (decision D3): Cloud Run scales
 * to zero and Neon offers no realtime channel, so a socket would need a
 * warm instance and a broker to carry data that changes every few seconds at
 * most.
 *
 * `router.refresh()` re-runs the Server Component and reconciles — it does not
 * blow away client state, so a half-typed bid amount survives a refresh.
 *
 * Mount on `/shipper/auction/[id]`, `/carrier`, and `/carrier/auction/[id]`.
 * Renders nothing.
 */
export function PollingRefresher({
  intervalMs = POLL_INTERVAL_MS,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    // A hidden tab must not poll: it is invisible, it burns a Cloud Run
    // request every 7s, and phones throttle the timer anyway.
    function tick() {
      if (document.visibilityState === "visible") router.refresh();
    }

    // Coming back to a backgrounded tab, the data on screen may be minutes
    // old — refresh at once rather than waiting out the interval.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") router.refresh();
    }

    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, router]);

  return null;
}
