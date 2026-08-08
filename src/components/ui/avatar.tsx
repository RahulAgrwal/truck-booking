import { cn } from "@/lib/design/cn";

/**
 * Avatar (TechnicalDocument.md §6.2) — top app bar and profile.
 *
 * Plain `<img>`, not `next/image`: Firebase profile photos are served from
 * `lh3.googleusercontent.com`, and `next/image` would need that host in
 * `images.remotePatterns` in `next.config.ts` — **a Lane A file**. A 40px
 * avatar gains nothing from the optimiser anyway. See `HANDOFF TO A` in
 * docs/progress-B.md if this should switch later.
 */

export type AvatarSize = "sm" | "md" | "lg";

const SIZE: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-label-bold font-label-bold",
  md: "h-10 w-10 text-body-md font-body-md",
  lg: "h-16 w-16 text-headline-md font-headline-md",
};

/** First letters of the first two words — "Ravi Kumar" → "RK". */
function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .filter(Boolean)
    .join("");
  return letters.toUpperCase() || "?";
}

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  /** Used for the initials fallback and the alt text — always required. */
  name: string;
  size?: AvatarSize;
  className?: string;
}) {
  const base = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    SIZE[size],
    className,
  );

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- see the note above: next/image would require a Lane A change to next.config.ts.
      <img src={src} alt={name} className={cn(base, "object-cover")} referrerPolicy="no-referrer" />
    );
  }

  return (
    // role/aria-label, not aria-hidden: the avatar is often the only thing
    // identifying the user in the app bar, so it needs an accessible name.
    <span
      className={cn(base, "bg-primary-fixed text-on-primary-fixed")}
      role="img"
      aria-label={name}
    >
      {initialsOf(name)}
    </span>
  );
}
