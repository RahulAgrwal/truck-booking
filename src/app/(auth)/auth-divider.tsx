/**
 * The hairline "or" rule between the email form and the Google button.
 *
 * Same construction as the route row's connector (CLAUDE.md §4.4): a full-width
 * 1px line with the label sitting on top of it, painted with the surface colour
 * so it punches a hole rather than overlapping.
 *
 * `aria-hidden` on the whole thing — "or" between two labelled controls is
 * visual grouping, and a screen reader announcing it between "Sign in" and
 * "Continue with Google" adds nothing.
 */
export function AuthDivider() {
  return (
    <div className="relative flex items-center justify-center" aria-hidden="true">
      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-outline-variant" />
      <span className="relative z-10 bg-surface px-stack-sm font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
        or
      </span>
    </div>
  );
}
