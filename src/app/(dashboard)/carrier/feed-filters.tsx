"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/design/cn";
import { FEED_FILTERS, buildFeedQuery, type FeedFilterKey } from "@/lib/design/feed";

import { Chip, ChipRow } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";

/**
 * Search box and filter chips for the carrier feed.
 *
 * **All state lives in the URL, never in this component.** `PollingRefresher`
 * calls `router.refresh()` every 7s; a filter held in `useState` would be
 * re-rendered from a server payload built for the *unfiltered* feed, so the
 * chips and the list would drift apart. `searchParams` survives a refresh
 * because it is part of the request.
 *
 * `router.replace`, not `push` — twelve keystrokes should not mean twelve
 * entries to back out through.
 */
export function FeedFilters({
  filter,
  query,
}: {
  filter: FeedFilterKey;
  query: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(query);
  // Distinguishes "the user typed" from "the server sent a new value".
  const dirty = useRef(false);

  // Keep the box in sync when the URL changes underneath us (back button,
  // or a chip tap that rebuilds the query string).
  useEffect(() => {
    if (!dirty.current) setDraft(query);
  }, [query]);

  // Debounce: one navigation per pause, not one per keystroke.
  useEffect(() => {
    if (!dirty.current) return;

    const id = setTimeout(() => {
      dirty.current = false;
      router.replace(`/carrier${buildFeedQuery(filter, draft.trim() || null)}`, { scroll: false });
    }, 300);

    return () => clearTimeout(id);
  }, [draft, filter, router]);

  function selectFilter(key: FeedFilterKey) {
    router.replace(`/carrier${buildFeedQuery(key, draft.trim() || null)}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-stack-sm">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Icon name="search" className="text-on-surface-variant" />
        </span>
        <input
          type="search"
          inputMode="search"
          value={draft}
          onChange={(event) => {
            dirty.current = true;
            setDraft(event.target.value);
          }}
          placeholder="Search cities, loads…"
          aria-label="Search loads by city or material"
          className={cn(
            "h-touch-target-min w-full rounded-lg border border-outline-variant bg-surface-container-lowest",
            // 16px text: anything smaller and iOS zooms the viewport on focus.
            "pr-3 pl-10 font-body-lg text-body-lg text-on-surface",
            "placeholder:text-on-surface-variant",
            "focus:border-primary focus:ring-2 focus:ring-primary-fixed focus:outline-none",
          )}
        />
      </div>

      <ChipRow>
        {FEED_FILTERS.map((item) =>
          item.enabled ? (
            <Chip
              key={item.key}
              label={item.label}
              selected={filter === item.key}
              onSelect={() => selectFilter(item.key)}
            />
          ) : (
            /*
              Nearby, rendered but dead (§10.4). Shown rather than hidden so the
              gap is honest: we store no carrier location, and `distanceKm` is
              the route's own length, not proximity to the pickup.
            */
            <span
              key={item.key}
              aria-disabled="true"
              title="Needs your location — not available yet"
              className={cn(
                "inline-flex h-touch-target-min shrink-0 cursor-not-allowed items-center gap-stack-sm",
                "rounded-full bg-surface-variant px-stack-md opacity-50",
                "font-label-bold text-label-bold whitespace-nowrap text-on-surface-variant",
              )}
            >
              {item.label}
              {item.note ? (
                <span className="rounded-full bg-surface-container-high px-2 py-px font-label-bold text-label-bold">
                  {item.note}
                </span>
              ) : null}
            </span>
          ),
        )}
      </ChipRow>
    </div>
  );
}
