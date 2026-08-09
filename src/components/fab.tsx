import Link from "next/link";

import { cn } from "@/lib/design/cn";

import { Icon } from "./ui/icon";

/**
 * Floating action button — shipper dashboard only, "post a load"
 * (CLAUDE.md §4.4, Stitch `2a58c34e…`).
 *
 * Sits above the bottom nav (`64px + 16px`) and below it in stacking order
 * (`z-40` against the nav's `z-50`), so it scrolls with nothing and never
 * covers a nav label. Icon-only, so `label` is required — it is the button's
 * only accessible name.
 */
export function Fab({
  href,
  icon = "add",
  label,
  className,
}: {
  href: string;
  icon?: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+64px+16px)] z-40",
        "flex h-14 w-14 items-center justify-center rounded-full",
        "bg-primary-container text-on-primary-container shadow-lg",
        "transition-transform active:scale-95",
        className,
      )}
    >
      <Icon name={icon} filled className="text-icon-xl" />
    </Link>
  );
}
