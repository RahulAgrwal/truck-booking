"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/design/cn";

/**
 * Filter chip (TechnicalDocument.md §6.2) — the row above the carrier feed.
 *
 * `"use client"`: filter chips are on CLAUDE.md §3.2's short list of things
 * that may hold client state, and this owns an `onSelect` handler.
 *
 * A chip is a toggle, not a link, so it is a real `<button>` with
 * `aria-pressed` — screen readers announce the on/off state, which colour
 * alone would not convey (§7.7).
 */
export function Chip({
  label,
  selected = false,
  onSelect,
  count,
  className,
}: {
  label: string;
  selected?: boolean;
  onSelect: () => void;
  /** Optional trailing count, e.g. a result total. */
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        // 48px tall like every other tap target (CLAUDE.md §3.1). Chips read
        // chunkier than a desktop filter bar; that is the point.
        "inline-flex h-touch-target-min shrink-0 items-center gap-stack-sm rounded-full px-stack-md",
        "font-label-bold text-label-bold whitespace-nowrap",
        "transition-transform active:scale-95",
        selected
          ? "bg-primary-container text-on-primary-container"
          : "bg-surface-variant text-on-surface-variant",
        className,
      )}
    >
      {label}
      {typeof count === "number" && (
        <span className={cn("font-label-bold text-label-bold", selected ? "opacity-80" : "opacity-70")}>
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Horizontal scroller for a chip row. `-mx-margin-mobile` + matching padding
 * lets the row bleed to the screen edge while the first chip still lines up
 * with the page gutter, and `overflow-x-auto` keeps the scroll inside the row
 * rather than on `<body>` (CLAUDE.md §3.1).
 */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-margin-mobile overflow-x-auto px-margin-mobile [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-stack-sm">{children}</div>
    </div>
  );
}
