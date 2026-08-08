import { cn } from "@/lib/design/cn";

/**
 * A Material Symbols glyph (CLAUDE.md §4.5).
 *
 * The icons are a webfont, not a React package — `name` is the ligature, e.g.
 * `local_shipping`. Lucide is explicitly superseded; do not install it.
 *
 * Not in TechnicalDocument.md §6.2's inventory, but every other primitive needs
 * one and `EmptyState` requires it as a prop, so it lives here rather than
 * being re-declared in nine files.
 */
export function Icon({
  name,
  filled = false,
  className,
  label,
}: {
  /** Material Symbols ligature, e.g. `local_shipping`. */
  name: string;
  /** `FILL 1` = active/selected, `FILL 0` = inactive/outline. */
  filled?: boolean;
  className?: string;
  /**
   * Only for an icon that carries meaning on its own. Icons inside a labelled
   * control stay decorative — the default `aria-hidden` is correct there.
   */
  label?: string;
}) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {name}
    </span>
  );
}
