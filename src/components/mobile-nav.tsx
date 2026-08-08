"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/design/cn";
import { NAV_ITEMS, isNavItemActive, rootsFor, type Role } from "@/lib/design/nav";

import { Icon } from "./ui/icon";

/**
 * The fixed bottom navigation (TechnicalDocument.md §7.1, Stitch `2a58c34e…`).
 *
 * `"use client"` for `usePathname` — the active tab is derived from the URL, so
 * callers cannot forget to pass it and it stays correct across client-side
 * navigation without a round trip.
 *
 * The item model and the active rule live in `@/lib/design/nav` so they can be
 * unit tested; this file is the rendering half only.
 */
export function MobileNav({
  role,
  active,
}: {
  role: Role;
  /** Override the URL-derived selection. Rarely needed. */
  active?: string;
}) {
  const pathname = usePathname();
  const current = active ?? pathname;
  const items = NAV_ITEMS[role];
  const roots = rootsFor(role);

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around bg-surface px-4 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.08)]"
      aria-label="Main"
    >
      {items.map((item) => {
        const selected = isNavItemActive(current, item.href, roots);
        return (
          <Link
            key={item.href}
            href={item.href}
            // aria-current, not colour alone (§7.7).
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex h-full w-16 flex-col items-center justify-center rounded-lg",
              "transition-transform active:scale-95",
              selected ? "text-primary" : "text-secondary",
            )}
          >
            {/* FILL 1 when selected, FILL 0 when not (CLAUDE.md §4.5). */}
            <Icon name={item.icon} filled={selected} className="mb-1" />
            <span className="font-label-bold text-label-bold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
