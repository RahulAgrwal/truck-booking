"use client";

import { useRouter } from "next/navigation";

import { Chip, ChipRow } from "@/components/ui/chip";
import { BID_TABS, type BidTabKey } from "@/lib/design/bids";

/**
 * Pending / Won / Lost.
 *
 * Selection lives in `searchParams`, not `useState` — same reason as the
 * carrier feed's filters: it has to survive a refresh, and it makes a tab
 * linkable.
 *
 * Built from `Chip`, not a new segmented-control component. Mobbin's
 * equivalents ([eBay Bids & offers], [Whatnot Activity]) use underline tabs for
 * status and pills for sub-filters, but that two-level hierarchy exists because
 * those screens have both. This screen has one level, so a second control
 * language would be invention for its own sake — and CLAUDE.md §4.6 says to
 * compose undesigned screens from primitives that already exist.
 */
export function BidTabs({ tab, counts }: { tab: BidTabKey; counts: Record<BidTabKey, number> }) {
  const router = useRouter();

  return (
    <ChipRow>
      {BID_TABS.map((item) => (
        <Chip
          key={item.key}
          label={item.label}
          count={counts[item.key]}
          selected={tab === item.key}
          onSelect={() => router.replace(`/carrier/bids?tab=${item.key}`, { scroll: false })}
        />
      ))}
    </ChipRow>
  );
}
