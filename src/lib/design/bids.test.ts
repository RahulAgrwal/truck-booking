import { describe, expect, it } from "vitest";

import { BID_TABS, emptyStateFor, parseBidTab, resolveBidStatus, statusForTab } from "./bids";

describe("parseBidTab", () => {
  it("accepts the three tabs", () => {
    expect(parseBidTab("pending")).toBe("pending");
    expect(parseBidTab("won")).toBe("won");
    expect(parseBidTab("lost")).toBe("lost");
  });

  it("defaults to pending for anything else", () => {
    expect(parseBidTab(undefined)).toBe("pending");
    expect(parseBidTab("")).toBe("pending");
    expect(parseBidTab("ACCEPTED")).toBe("pending");
    expect(parseBidTab(["won", "lost"])).toBe("won");
  });
});

describe("statusForTab", () => {
  it("maps each tab to the Bid status it selects", () => {
    expect(statusForTab("pending")).toBe("PENDING");
    expect(statusForTab("won")).toBe("ACCEPTED");
    expect(statusForTab("lost")).toBe("REJECTED");
  });
});

describe("resolveBidStatus", () => {
  const now = new Date("2026-08-09T12:00:00Z").getTime();
  const future = new Date("2026-08-09T14:00:00Z");
  const past = new Date("2026-08-09T11:00:00Z");

  it("shows a live countdown only while the bid can still be won", () => {
    expect(resolveBidStatus("PENDING", "ACTIVE", future, now)).toEqual({
      label: "Pending",
      tone: "brand",
      showTimer: true,
    });
  });

  it("calls an accepted bid Won and a rejected one Lost, regardless of the auction", () => {
    expect(resolveBidStatus("ACCEPTED", "COMPLETED_ASSIGNED", past, now).label).toBe("Won");
    expect(resolveBidStatus("REJECTED", "COMPLETED_ASSIGNED", past, now).label).toBe("Lost");
    // Neither should ever tick.
    expect(resolveBidStatus("ACCEPTED", "ACTIVE", future, now).showTimer).toBe(false);
  });

  it("does not call a PENDING bid on an expired auction 'Pending'", () => {
    // Cron sets CLOSED_EXPIRED and leaves bids PENDING — nobody won (§5.5).
    // "Pending" would promise an outcome that can never arrive.
    const resolved = resolveBidStatus("PENDING", "CLOSED_EXPIRED", past, now);
    expect(resolved.label).toBe("Auction expired");
    expect(resolved.showTimer).toBe(false);
  });

  it("trusts endTime over a stale ACTIVE status, because cron lags up to 60s", () => {
    // The row still says ACTIVE, but the deadline has passed.
    const resolved = resolveBidStatus("PENDING", "ACTIVE", past, now);
    expect(resolved.label).toBe("Auction expired");
    expect(resolved.showTimer).toBe(false);
  });

  it("treats the exact deadline as expired", () => {
    const resolved = resolveBidStatus("PENDING", "ACTIVE", new Date(now), now);
    expect(resolved.label).toBe("Auction expired");
  });

  it("accepts an ISO string, since that is what crosses the server boundary", () => {
    expect(resolveBidStatus("PENDING", "ACTIVE", future.toISOString(), now).showTimer).toBe(true);
  });

  it("never signals by colour alone — every state carries a word", () => {
    const cases = [
      resolveBidStatus("PENDING", "ACTIVE", future, now),
      resolveBidStatus("PENDING", "CLOSED_EXPIRED", past, now),
      resolveBidStatus("ACCEPTED", "COMPLETED_ASSIGNED", past, now),
      resolveBidStatus("REJECTED", "COMPLETED_ASSIGNED", past, now),
    ];
    for (const resolved of cases) {
      expect(resolved.label.length).toBeGreaterThan(0);
    }
    // And the four situations are actually distinguishable by text.
    expect(new Set(cases.map((c) => c.label)).size).toBe(4);
  });
});

describe("emptyStateFor", () => {
  it("gives each tab its own copy", () => {
    const titles = BID_TABS.map((tab) => emptyStateFor(tab.key).title);
    expect(new Set(titles).size).toBe(BID_TABS.length);
  });
});
