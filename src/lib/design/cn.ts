/**
 * Join class names, dropping falsy entries.
 *
 * Deliberately not `clsx` + `tailwind-merge`: those are two dependencies to
 * solve a problem the primitives avoid by construction. Nothing here emits two
 * classes from the same Tailwind group, so there is no conflict to resolve —
 * a variant map picks exactly one value per property.
 *
 * The one thing this cannot do is let a caller's `className` override a
 * variant's. Tailwind resolves conflicts by CSS source order, not by the order
 * of names in the attribute, so `<Button className="bg-error">` is not
 * guaranteed to win. Add a variant instead of fighting it.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
