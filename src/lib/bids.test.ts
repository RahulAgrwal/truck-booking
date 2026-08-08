import { describe, expect, it } from "vitest";

import { bestBidId, latestBidPerCarrier, type RankableBid } from "./bids";

const at = (iso: string) => new Date(iso);

function bid(id: string, carrierId: string, amount: number, iso: string): RankableBid {
  return { id, carrierId, amount, createdAt: at(iso) };
}

describe("latestBidPerCarrier", () => {
  it("collapses a carrier's history to one row", () => {
    // The bug this prevents: one carrier bidding three times looking like
    // three competitors on the shipper's screen.
    const rows = latestBidPerCarrier([
      bid("b1", "c1", 12_000, "2026-08-09T10:00:00Z"),
      bid("b2", "c1", 11_500, "2026-08-09T10:05:00Z"),
      bid("b3", "c1", 11_000, "2026-08-09T10:10:00Z"),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("b3");
  });

  it("keeps the LATEST bid, which is what §3.3 says — not the lowest", () => {
    // These coincide while submitBid guard 6 holds. Pinned separately so a
    // future relaxation of that guard shows up here rather than in the UI.
    const rows = latestBidPerCarrier([
      bid("cheap-but-old", "c1", 9_000, "2026-08-09T10:00:00Z"),
      bid("dearer-but-new", "c1", 10_000, "2026-08-09T10:05:00Z"),
    ]);

    expect(rows[0]?.id).toBe("dearer-but-new");
  });

  it("orders the surviving rows by amount ascending", () => {
    const rows = latestBidPerCarrier([
      bid("b1", "c1", 12_000, "2026-08-09T10:00:00Z"),
      bid("b2", "c2", 10_000, "2026-08-09T10:01:00Z"),
      bid("b3", "c3", 11_000, "2026-08-09T10:02:00Z"),
    ]);

    expect(rows.map((r) => r.id)).toEqual(["b2", "b3", "b1"]);
  });

  it("is deterministic when two carriers tie on amount", () => {
    const rows = latestBidPerCarrier([
      bid("later", "c2", 10_000, "2026-08-09T10:05:00Z"),
      bid("earlier", "c1", 10_000, "2026-08-09T10:00:00Z"),
    ]);

    expect(rows.map((r) => r.id)).toEqual(["earlier", "later"]);
  });

  it("breaks a same-millisecond tie by the lower amount, not query order", () => {
    const rows = latestBidPerCarrier([
      bid("high", "c1", 12_000, "2026-08-09T10:00:00Z"),
      bid("low", "c1", 11_000, "2026-08-09T10:00:00Z"),
    ]);

    expect(rows[0]?.id).toBe("low");
  });

  it("accepts ISO strings, since that is what crosses the server boundary", () => {
    const rows = latestBidPerCarrier([
      { id: "b1", carrierId: "c1", amount: 12_000, createdAt: "2026-08-09T10:00:00Z" },
      { id: "b2", carrierId: "c1", amount: 11_000, createdAt: "2026-08-09T10:05:00Z" },
    ]);

    expect(rows[0]?.id).toBe("b2");
  });

  it("handles an empty list", () => {
    expect(latestBidPerCarrier([])).toEqual([]);
  });
});

describe("bestBidId", () => {
  it("picks the global minimum", () => {
    expect(
      bestBidId([
        bid("b1", "c1", 12_000, "2026-08-09T10:00:00Z"),
        bid("b2", "c2", 10_000, "2026-08-09T10:01:00Z"),
        bid("b3", "c3", 11_000, "2026-08-09T10:02:00Z"),
      ]),
    ).toBe("b2");
  });

  it("gives a tie to the EARLIEST bid — whoever got there first (§3.3)", () => {
    expect(
      bestBidId([
        bid("late", "c2", 10_000, "2026-08-09T10:05:00Z"),
        bid("early", "c1", 10_000, "2026-08-09T10:00:00Z"),
      ]),
    ).toBe("early");
  });

  it("is order-independent for that tie", () => {
    const early = bid("early", "c1", 10_000, "2026-08-09T10:00:00Z");
    const late = bid("late", "c2", 10_000, "2026-08-09T10:05:00Z");

    expect(bestBidId([early, late])).toBe("early");
    expect(bestBidId([late, early])).toBe("early");
  });

  it("returns null with no bids, so the badge simply does not render", () => {
    expect(bestBidId([])).toBeNull();
  });

  it("badges exactly one row across the reduced list", () => {
    const reduced = latestBidPerCarrier([
      bid("b1", "c1", 12_000, "2026-08-09T10:00:00Z"),
      bid("b2", "c1", 10_000, "2026-08-09T10:05:00Z"),
      bid("b3", "c2", 10_000, "2026-08-09T10:06:00Z"),
    ]);
    const best = bestBidId(reduced);

    expect(reduced.filter((r) => r.id === best)).toHaveLength(1);
    // c1 got to 10,000 first, so c1 keeps the badge.
    expect(best).toBe("b2");
  });
});
