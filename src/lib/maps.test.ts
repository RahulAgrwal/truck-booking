import { describe, expect, it } from "vitest";

import { metresToKm, parseDistanceMatrix, secondsToMinutes } from "./maps";

const route = (metres: number, seconds: number, elementStatus = "OK", status = "OK") => ({
  status,
  rows: [
    { elements: [{ status: elementStatus, distance: { value: metres }, duration: { value: seconds } }] },
  ],
});

describe("unit conversion", () => {
  it("converts metres to kilometres at one decimal", () => {
    expect(metresToKm(148_200)).toBe(148.2);
    expect(metresToKm(1_000)).toBe(1);
    expect(metresToKm(10_490)).toBe(10.5);
    // Rounds to the nearest 100 m, so a sub-100 m remainder disappears.
    expect(metresToKm(1_049)).toBe(1);
    expect(metresToKm(0)).toBe(0);
  });

  it("converts seconds to whole minutes", () => {
    expect(secondsToMinutes(11_700)).toBe(195);
    expect(secondsToMinutes(59)).toBe(1);
    expect(secondsToMinutes(29)).toBe(0);
  });
});

describe("parseDistanceMatrix", () => {
  it("reads distance and duration from a healthy response", () => {
    const result = parseDistanceMatrix(route(148_200, 11_700));
    expect(result).toEqual({ ok: true, data: { distanceKm: 148.2, estimatedTimeMins: 195 } });
  });

  /**
   * The trap this whole function exists for: the request succeeded, so the
   * top-level status is OK, but *this pair* is not routable. Reading only
   * json.status yields undefined distances and a row of nulls in the database.
   */
  it("catches ZERO_RESULTS on the element even when the request status is OK", () => {
    const result = parseDistanceMatrix(route(0, 0, "ZERO_RESULTS"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/couldn't find a driving route/i);
  });

  it("treats NOT_FOUND the same way", () => {
    const result = parseDistanceMatrix(route(0, 0, "NOT_FOUND"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/couldn't find a driving route/i);
  });

  it("gives a distinct message for quota exhaustion, which is retryable", () => {
    const result = parseDistanceMatrix({ status: "OVER_QUERY_LIMIT" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/busy/i);
  });

  it("never leaks Google's error_message, which can echo the API key", () => {
    const result = parseDistanceMatrix({
      status: "REQUEST_DENIED",
      error_message: "The provided API key is invalid: AIzaSyFAKEKEY123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toMatch(/AIza/);
      expect(result.error).toBe("Could not calculate the route. Please try again.");
    }
  });

  it("fails safely on a malformed or empty body", () => {
    expect(parseDistanceMatrix({}).ok).toBe(false);
    expect(parseDistanceMatrix({ status: "OK", rows: [] }).ok).toBe(false);
    expect(parseDistanceMatrix({ status: "OK", rows: [{ elements: [] }] }).ok).toBe(false);
    expect(parseDistanceMatrix(null).ok).toBe(false);
  });

  it("rejects an element that claims OK but carries no numbers", () => {
    const result = parseDistanceMatrix({ status: "OK", rows: [{ elements: [{ status: "OK" }] }] });
    expect(result.ok).toBe(false);
  });
});
