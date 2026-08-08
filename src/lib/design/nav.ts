/**
 * The bottom navigation's model, split out from `mobile-nav.tsx` so the
 * active-item rule can be unit tested — the component itself imports
 * `next/navigation` and cannot be loaded in vitest's node environment.
 *
 * It lives under `src/lib/design/` because that is Lane B's tree
 * (BuildPlan.md §3); `src/lib/` proper belongs to Lane A.
 */

export type Role = "SHIPPER" | "CARRIER";

export type NavItem = {
  href: string;
  label: string;
  /** Material Symbols ligature. */
  icon: string;
};

/**
 * Three items per role, never more — a fourth drops each target below a
 * comfortable thumb width on a 390px screen.
 */
export const NAV_ITEMS: Record<Role, readonly NavItem[]> = {
  SHIPPER: [
    { href: "/shipper", label: "Home", icon: "home" },
    { href: "/shipper/history", label: "History", icon: "history" },
    { href: "/profile", label: "Profile", icon: "person" },
  ],
  CARRIER: [
    { href: "/carrier", label: "Find Loads", icon: "search" },
    { href: "/carrier/bids", label: "My Bids", icon: "gavel" },
    { href: "/profile", label: "Profile", icon: "person" },
  ],
} as const;

/**
 * Is `href` the selected tab for `pathname`?
 *
 * The subtlety: a role's home (`/shipper`, `/carrier`) is a prefix of every
 * other route in that role, so matching by prefix alone would light up Home on
 * every screen. Roots therefore match **exactly**; everything else matches
 * itself or a deeper segment, so `/carrier/bids` stays selected on a
 * hypothetical `/carrier/bids/123`.
 *
 * Segment-aware: `/carrier/bids` must not be considered active for
 * `/carrier/bidsomething`.
 */
export function isNavItemActive(pathname: string, href: string, roots: readonly string[]): boolean {
  if (roots.includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The hrefs that must match exactly: each role's home, plus the shared profile.
 *
 * The home route is hard-coded per role rather than read as `NAV_ITEMS[role][0]`
 * — indexing a `readonly NavItem[]` is `NavItem | undefined` under
 * `noUncheckedIndexedAccess`, and a non-null assertion here would only be
 * hiding the fact that "the first item is home" is an ordering assumption.
 */
const HOME: Record<Role, string> = {
  SHIPPER: "/shipper",
  CARRIER: "/carrier",
};

export function rootsFor(role: Role): readonly string[] {
  return [HOME[role], "/profile"];
}
