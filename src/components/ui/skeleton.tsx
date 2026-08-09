import { cn } from "@/lib/design/cn";

/**
 * Skeleton (TechnicalDocument.md §6.2) — for every `loading.tsx`.
 *
 * §7.5 asks the skeleton to match the real card's geometry. A skeleton with
 * different proportions than the content it stands in for causes a visible
 * jump on hydration, which is worse than a spinner.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn("block animate-pulse rounded bg-surface-container-high", className)}
      aria-hidden="true"
    />
  );
}

/**
 * @param lines   text rows to draw
 * @param variant `text` = bare lines · `card` = lines inside the Card shell
 */
export function SkeletonBlock({
  lines = 3,
  variant = "text",
  className,
}: {
  lines?: number;
  variant?: "text" | "card";
  className?: string;
}) {
  const body = (
    <div className="flex flex-col gap-stack-sm">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          // Last line short, like real ragged text.
          className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );

  if (variant === "card") {
    return (
      <div
        className={cn(
          "bg-surface-container-lowest border border-surface-variant rounded-lg p-gutter-mobile",
          "shadow-[0_4px_12px_rgba(0,33,83,0.08)]",
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return <div className={className}>{body}</div>;
}

/**
 * The loading state for a feed: `count` card skeletons at the real card's
 * rhythm. The whole list is one `aria-busy` region so a screen reader
 * announces "busy" once instead of narrating every placeholder.
 */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-stack-md" aria-busy="true" aria-live="polite" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} variant="card" lines={3} />
      ))}
    </div>
  );
}
