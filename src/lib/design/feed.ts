/**
 * The carrier feed's filter model.
 *
 * Split out of the components for the same two reasons as `nav.ts`: the chip
 * row is a client component and the page is a Server Component, so the shared
 * vocabulary cannot live in either; and a plain module is unit-testable, while
 * anything importing `next/navigation` is not. It sits under
 * `src/lib/design/` because that is Lane B's tree (BuildPlan.md §3).
 */

export type FeedFilterKey = "all" | "expiring" | "heavy" | "nearby";

export type FeedFilter = {
  key: FeedFilterKey;
  label: string;
  /** A disabled chip still renders — it just cannot be selected. */
  enabled: boolean;
  /** Shown on the chip when disabled. */
  note?: string;
};

/** "Expiring Soon" means the auction closes within the hour. */
export const EXPIRING_SOON_MS = 60 * 60 * 1000;

/** "High Weight" means 10 tonnes or more. The schema stores kilograms. */
export const HIGH_WEIGHT_KG = 10_000;

export const FEED_FILTERS: readonly FeedFilter[] = [
  { key: "all", label: "All", enabled: true },
  /*
    Nearby is deliberately dead (TechnicalDocument.md §10.4). `distanceKm` is
    the length of the auction's OWN route, not the carrier's distance from the
    pickup — we store no carrier location at all. Repurposing it would show a
    confident "15 km away" that is simply false, which is worse than showing
    nothing. It renders disabled rather than being hidden, so the absence is
    honest instead of invisible.
  */
  { key: "nearby", label: "Nearby", enabled: false, note: "Soon" },
  { key: "expiring", label: "Expiring Soon", enabled: true },
  { key: "heavy", label: "High Weight", enabled: true },
] as const;

/**
 * URL `?filter=` → a filter we will actually honour.
 *
 * Anything unrecognised falls back to `all`, and so does `nearby` — a
 * hand-typed `?filter=nearby` must not quietly become a filter the UI refuses
 * to offer. Untrusted input, treated as such.
 */
export function parseFeedFilter(raw: string | string[] | undefined): FeedFilterKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = FEED_FILTERS.find((filter) => filter.key === value);
  return match && match.enabled ? match.key : "all";
}

/** URL `?q=` → a trimmed search term, or null when there is nothing to search for. */
export function parseSearchQuery(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  // Cap it: the value goes into a SQL `contains`, and no city name is this long.
  return trimmed.length === 0 ? null : trimmed.slice(0, 100);
}

/**
 * "148 km · ~3h 15m" for a card or a summary line (TechnicalDocument.md §10.4).
 *
 * All six route fields are nullable — Maps runs in degraded mode whenever no
 * key is configured (§10.3), and auctions created before the feature have none
 * either. The whole point of this function is that there is exactly one place
 * where that can turn into `undefined km`, and it says "Distance unavailable"
 * instead.
 *
 * Duration is dropped rather than faked when only the distance resolved.
 */
export function formatRouteSummary(
  distanceKm: number | null | undefined,
  estimatedTimeMins: number | null | undefined,
): string {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) {
    return "Distance unavailable";
  }

  const distance = `${Math.round(distanceKm)} km`;

  if (typeof estimatedTimeMins !== "number" || !Number.isFinite(estimatedTimeMins) || estimatedTimeMins <= 0) {
    return distance;
  }

  const hours = Math.floor(estimatedTimeMins / 60);
  const minutes = Math.round(estimatedTimeMins % 60);
  const duration = hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`) : `${minutes}m`;

  // "~" because the Distance Matrix number is an estimate, not a promise.
  return `${distance} · ~${duration}`;
}

/**
 * Build the `?filter=&q=` query string, omitting defaults so the common URL
 * stays clean (`/carrier`, not `/carrier?filter=all&q=`).
 */
export function buildFeedQuery(filter: FeedFilterKey, query: string | null): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `?${search}` : "";
}
