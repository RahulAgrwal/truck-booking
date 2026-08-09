import { describe, expect, it } from "vitest";

import {
  formatINR,
  formatPhone,
  formatRelativeTime,
  formatRemaining,
  formatTruckNumber,
  formatWeight,
  kgToTons,
  normalizePhone,
  normalizeTruckNumber,
  telHref,
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

/*
  Contact formatters (docs/feature-contact-ratings.md §4). Added with B6 rather
  than B2 because B2's ledger named the normalisers as the most likely thing to
  be wrong in that step, and a named suspect with no test is just a guess.

  These are pure string functions. What they format is sensitive; deciding who
  sees it is contact.ts's job and none of theirs.
*/

describe("normalizePhone", () => {
  it("keeps ten bare digits as they are", () => {
    expect(normalizePhone("9876543210")).toBe("9876543210");
  });

  it("strips the punctuation a human types", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210");
    expect(normalizePhone("98765-43210")).toBe("9876543210");
    expect(normalizePhone("(98765) 43210")).toBe("9876543210");
  });

  it("drops a +91 country code, however it was written", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("+919876543210")).toBe("9876543210");
    expect(normalizePhone("91-98765-43210")).toBe("9876543210");
  });

  it("drops the leading 0 of the domestic dialling form", () => {
    expect(normalizePhone("09876543210")).toBe("9876543210");
  });

  /**
   * The gap B2's ledger flagged: "+910…" is 13 digits, so it matches neither
   * the 12-digit `91` branch nor the 11-digit `0` branch and survives intact.
   * Pinned as *known behaviour* rather than quietly fixed — it fails validation
   * with "Enter a valid 10-digit Indian mobile number", which is a better
   * outcome than silently accepting a number nobody meant to type.
   */
  it("leaves +910… alone, so the schema rejects it rather than guessing", () => {
    expect(normalizePhone("+9109876543210")).toBe("9109876543210");
  });

  it("returns whatever digits it found, valid or not — validation is elsewhere", () => {
    expect(normalizePhone("abc")).toBe("");
    expect(normalizePhone("12345")).toBe("12345");
  });
});

describe("formatPhone", () => {
  it("renders the display form", () => {
    expect(formatPhone("9876543210")).toBe("+91 98765 43210");
  });

  it("normalises first, so a stored or a typed value both work", () => {
    expect(formatPhone("+91 98765 43210")).toBe("+91 98765 43210");
    expect(formatPhone("09876543210")).toBe("+91 98765 43210");
  });

  it("returns anything it cannot parse untouched, rather than a mangled string", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("")).toBe("");
  });
});

describe("telHref", () => {
  it("is E.164, never the spaced display form", () => {
    expect(telHref("9876543210")).toBe("tel:+919876543210");
    expect(telHref("+91 98765 43210")).toBe("tel:+919876543210");
  });

  it("falls back to the bare digits when it is not a 10-digit number", () => {
    expect(telHref("12345")).toBe("tel:12345");
  });
});

describe("normalizeTruckNumber", () => {
  it("uppercases and strips every separator", () => {
    expect(normalizeTruckNumber("mh 12 ab 1234")).toBe("MH12AB1234");
    expect(normalizeTruckNumber("MH-12-AB-1234")).toBe("MH12AB1234");
    expect(normalizeTruckNumber("MH12AB1234")).toBe("MH12AB1234");
  });
});

describe("formatTruckNumber", () => {
  it("groups the four parts of a plate", () => {
    expect(formatTruckNumber("MH12AB1234")).toBe("MH 12 AB 1234");
    expect(formatTruckNumber("PB10CD5678")).toBe("PB 10 CD 5678");
  });

  it("handles a single-digit district and a one-letter series", () => {
    expect(formatTruckNumber("DL1C1234")).toBe("DL 1 C 1234");
  });

  it("handles the older no-series plates", () => {
    expect(formatTruckNumber("HR26 1234")).toBe("HR 26 1234");
  });

  /**
   * The other suspect B2 named: BH-series plates (`22BH1234AA`) and a few older
   * formats do not match, and come back normalised instead of grouped. Pinned
   * as known behaviour — TRUCK_NUMBER_RE rejects them at the form, so no such
   * value can reach this function from our own database.
   */
  it("returns an unrecognised plate normalised rather than throwing", () => {
    expect(formatTruckNumber("22 bh 1234 aa")).toBe("22BH1234AA");
  });
});
