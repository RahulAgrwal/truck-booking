import { describe, expect, it } from "vitest";

import { NAV_ITEMS, isNavItemActive, rootsFor } from "./nav";

/**
 * The nav's active rule. Worth its own test because both failure modes are
 * silent: Home lit on every screen, or no tab lit at all on a nested route.
 */
describe("isNavItemActive", () => {
  const shipperRoots = rootsFor("SHIPPER");
  const carrierRoots = rootsFor("CARRIER");

  it("lights the role home only on the role home itself", () => {
    expect(isNavItemActive("/shipper", "/shipper", shipperRoots)).toBe(true);
    // The bug this exists to prevent: /shipper is a prefix of every shipper route.
    expect(isNavItemActive("/shipper/history", "/shipper", shipperRoots)).toBe(false);
    expect(isNavItemActive("/shipper/create", "/shipper", shipperRoots)).toBe(false);
    expect(isNavItemActive("/shipper/auction/abc", "/shipper", shipperRoots)).toBe(false);
  });

  it("keeps a non-root tab lit on its own deeper routes", () => {
    expect(isNavItemActive("/carrier/bids", "/carrier/bids", carrierRoots)).toBe(true);
    expect(isNavItemActive("/carrier/bids/123", "/carrier/bids", carrierRoots)).toBe(true);
  });

  it("matches whole segments, not string prefixes", () => {
    expect(isNavItemActive("/carrier/bidsomething", "/carrier/bids", carrierRoots)).toBe(false);
    expect(isNavItemActive("/shipper/historyx", "/shipper/history", shipperRoots)).toBe(false);
  });

  it("treats /profile as a root, shared by both roles", () => {
    expect(isNavItemActive("/profile", "/profile", shipperRoots)).toBe(true);
    expect(isNavItemActive("/profile", "/profile", carrierRoots)).toBe(true);
    expect(isNavItemActive("/profile/settings", "/profile", shipperRoots)).toBe(false);
  });

  it("lights exactly one tab for every route a role can reach", () => {
    const routes = {
      SHIPPER: ["/shipper", "/shipper/history", "/shipper/create", "/shipper/auction/abc", "/profile"],
      CARRIER: ["/carrier", "/carrier/bids", "/carrier/auction/abc", "/profile"],
    } as const;

    for (const role of ["SHIPPER", "CARRIER"] as const) {
      const roots = rootsFor(role);
      for (const pathname of routes[role]) {
        const lit = NAV_ITEMS[role].filter((item) => isNavItemActive(pathname, item.href, roots));
        // /shipper/create and /shipper/auction/* are intentionally tab-less:
        // they are pushed screens, not destinations.
        expect(lit.length, `${role} ${pathname} lit ${lit.length} tabs`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("NAV_ITEMS", () => {
  it("gives each role exactly three items", () => {
    expect(NAV_ITEMS.SHIPPER).toHaveLength(3);
    expect(NAV_ITEMS.CARRIER).toHaveLength(3);
  });

  it("ends both roles on the shared profile route", () => {
    expect(NAV_ITEMS.SHIPPER.at(-1)?.href).toBe("/profile");
    expect(NAV_ITEMS.CARRIER.at(-1)?.href).toBe("/profile");
  });
});
