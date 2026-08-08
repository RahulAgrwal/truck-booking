import { describe, expect, it } from "vitest";

import {
  EXPIRING_SOON_MS,
  FEED_FILTERS,
  HIGH_WEIGHT_KG,
  buildFeedQuery,
  formatRouteSummary,
  parseFeedFilter,
  parseSearchQuery,
} from "./feed";

describe("parseFeedFilter", () => {
  it("accepts the enabled filters", () => {
    expect(parseFeedFilter("all")).toBe("all");
    expect(parseFeedFilter("expiring")).toBe("expiring");
    expect(parseFeedFilter("heavy")).toBe("heavy");
  });

  it("refuses a hand-typed ?filter=nearby, because Nearby is not implemented", () => {
    // The UI renders it disabled; the URL must not be a way around that.
    expect(parseFeedFilter("nearby")).toBe("all");
  });

  it("falls back to all for anything unrecognised", () => {
    expect(parseFeedFilter(undefined)).toBe("all");
    expect(parseFeedFilter("")).toBe("all");
    expect(parseFeedFilter("../../etc/passwd")).toBe("all");
    expect(parseFeedFilter("HEAVY")).toBe("all");
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseFeedFilter(["heavy", "expiring"])).toBe("heavy");
    expect(parseFeedFilter(["bogus", "heavy"])).toBe("all");
  });
});

describe("parseSearchQuery", () => {
  it("trims, and treats blank as no search at all", () => {
    expect(parseSearchQuery("  Mumbai  ")).toBe("Mumbai");
    expect(parseSearchQuery("   ")).toBeNull();
    expect(parseSearchQuery("")).toBeNull();
    expect(parseSearchQuery(undefined)).toBeNull();
  });

  it("caps the length — the value reaches a SQL contains", () => {
    expect(parseSearchQuery("x".repeat(500))).toHaveLength(100);
  });
});

describe("buildFeedQuery", () => {
  it("omits defaults so the common URL stays bare", () => {
    expect(buildFeedQuery("all", null)).toBe("");
  });

  it("encodes what is actually set", () => {
    expect(buildFeedQuery("heavy", null)).toBe("?filter=heavy");
    expect(buildFeedQuery("all", "Pune")).toBe("?q=Pune");
    expect(buildFeedQuery("expiring", "New Delhi")).toBe("?filter=expiring&q=New+Delhi");
  });

  it("round-trips through parseFeedFilter", () => {
    for (const filter of FEED_FILTERS.filter((f) => f.enabled)) {
      const url = new URLSearchParams(buildFeedQuery(filter.key, null).replace(/^\?/, ""));
      expect(parseFeedFilter(url.get("filter") ?? undefined)).toBe(filter.key);
    }
  });
});

describe("formatRouteSummary", () => {
  it("combines distance and duration", () => {
    expect(formatRouteSummary(148, 195)).toBe("148 km · ~3h 15m");
  });

  it("drops the minutes on a whole hour, and the hours under one", () => {
    expect(formatRouteSummary(200, 120)).toBe("200 km · ~2h");
    expect(formatRouteSummary(12, 25)).toBe("12 km · ~25m");
  });

  it("rounds the distance rather than showing Distance Matrix decimals", () => {
    expect(formatRouteSummary(148.37, 60)).toBe("148 km · ~1h");
  });

  it("says so when the route never resolved, instead of 'undefined km'", () => {
    // Degraded Maps mode (§10.3) and pre-feature auctions both land here.
    expect(formatRouteSummary(null, null)).toBe("Distance unavailable");
    expect(formatRouteSummary(undefined, undefined)).toBe("Distance unavailable");
    expect(formatRouteSummary(Number.NaN, 60)).toBe("Distance unavailable");
  });

  it("drops the duration rather than faking one when only distance resolved", () => {
    expect(formatRouteSummary(148, null)).toBe("148 km");
    expect(formatRouteSummary(148, 0)).toBe("148 km");
  });
});

describe("filter thresholds", () => {
  it("pins Expiring Soon to one hour and High Weight to ten tonnes", () => {
    // Guards against a silent unit slip: the schema stores kg, the UI shows tonnes.
    expect(EXPIRING_SOON_MS).toBe(60 * 60 * 1000);
    expect(HIGH_WEIGHT_KG).toBe(10_000);
  });

  it("keeps Nearby disabled — no carrier location is stored", () => {
    expect(FEED_FILTERS.find((f) => f.key === "nearby")?.enabled).toBe(false);
  });
});
