"use client";

import { useEffect, useState } from "react";

import { Icon } from "./ui/icon";

/**
 * Sticky "you're offline" banner (TechnicalDocument.md §7.5).
 *
 * This app has **no service worker, deliberately** (§7.2): caching a live
 * auction feed would show stale prices and stale countdowns, which is worse
 * than an honest failure. That decision is exactly why this banner has to
 * exist — offline is a state the user has to be told about, because nothing
 * else will degrade gracefully on their behalf.
 *
 * Rendered by `AppShell`, so it covers every route in both lanes.
 */
export function OfflineBanner() {
  /*
    Starts `true` rather than reading `navigator.onLine` during render: the
    server has no such API, and seeding state from it would either crash SSR or
    hydrate to a mismatch. The effect corrects it on mount, and being briefly
    wrong in the optimistic direction is the right failure — a banner that
    flashes on every load would be worse than one that appears a tick late.
  */
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    /*
      The events only fire on a *change*, so a page loaded while already
      offline would never hear one — hence an explicit first read. On a
      macrotask rather than synchronously in the effect body: a synchronous
      setState here cascades an extra render before paint on every route,
      since this sits in `AppShell`.
    */
    const first = setTimeout(() => setOnline(navigator.onLine), 0);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      clearTimeout(first);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      // polite, not assertive: losing signal is not worth interrupting whatever
      // the screen reader is in the middle of saying.
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 z-[55] flex w-full items-center justify-center gap-stack-sm bg-error-container px-margin-mobile pt-safe pb-stack-sm text-on-error-container"
    >
      <span className="flex items-center gap-stack-sm pt-stack-sm">
        <Icon name="cloud_off" filled className="text-[18px]" />
        <span className="font-label-bold text-label-bold">
          You&apos;re offline — prices may be out of date
        </span>
      </span>
    </div>
  );
}
