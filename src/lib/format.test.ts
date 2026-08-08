import { describe, expect, it } from "vitest";

import {
  formatINR,
  formatRelativeTime,
  formatRemaining,
  formatWeight,
  kgToTons,
  tonsToKg,
} from "./format";

const NOW = new Date("2026-01-01T12:00:00.000Z").getTime();
const at = (offsetMs: number) => new Date(NOW + offsetMs);

describe("formatINR", () => {
  it("uses Indian digit grouping and drops paise", () => {
    expect(formatINR(450000)).toBe("₹4,50,000");
    expect(formatINR(42000)).toBe("₹42,000");
    expect(formatINR(999.6)).toBe("₹1,000");
  });
});

describe("weight conversion", () => {
  it("round-trips tonnes and kilograms", () => {
    expect(tonsToKg(5)).toBe(5000);
    expect(kgToTons(5000)).toBe(5);
    expect(kgToTons(tonsToKg(12.5))).toBe(12.5);
  });

  it("singularises exactly one tonne", () => {
    expect(formatWeight(5000)).toBe("5 Tons");
    expect(formatWeight(1000)).toBe("1 Ton");
    expect(formatWeight(500)).toBe("0.5 Tons");
  });
});

describe("formatRemaining", () => {
  it("shows hours and minutes above an hour", () => {
    expect(formatRemaining(at(2 * 3600_000 + 14 * 60_000), NOW).label).toBe("02h 14m");
  });

  it("switches to minutes and seconds below an hour", () => {
    expect(formatRemaining(at(45 * 60_000 + 12_000), NOW).label).toBe("45m 12s");
  });

  it("zero-pads the final minute", () => {
    expect(formatRemaining(at(9_000), NOW).label).toBe("00m 09s");
  });

  it("marks the last 30 minutes urgent, and not a second earlier", () => {
    expect(formatRemaining(at(30 * 60_000), NOW).urgent).toBe(true);
    expect(formatRemaining(at(30 * 60_000 + 1), NOW).urgent).toBe(false);
  });

  it("clamps an elapsed deadline to expired rather than going negative", () => {
    const past = formatRemaining(at(-5000), NOW);
    expect(past).toMatchObject({ ms: 0, expired: true, label: "Expired" });
  });

  it("treats the exact deadline as expired", () => {
    expect(formatRemaining(at(0), NOW).expired).toBe(true);
  });

  it("accepts an ISO string, since that is what crosses the server boundary", () => {
    expect(formatRemaining(at(3600_000).toISOString(), NOW).label).toBe("01h 00m");
  });
});

describe("formatRelativeTime", () => {
  it("describes how long ago a bid landed", () => {
    expect(formatRelativeTime(at(-30_000), NOW)).toBe("just now");
    expect(formatRelativeTime(at(-60_000), NOW)).toBe("1 min ago");
    expect(formatRelativeTime(at(-5 * 60_000), NOW)).toBe("5 mins ago");
    expect(formatRelativeTime(at(-2 * 3600_000), NOW)).toBe("2 hours ago");
    expect(formatRelativeTime(at(-3 * 86_400_000), NOW)).toBe("3 days ago");
  });
});
