import "server-only";

/**
 * Google Distance Matrix (TechnicalDocument.md §10.2).
 *
 * Uses GOOGLE_MAPS_SERVER_API_KEY, which must never reach the browser: no
 * NEXT_PUBLIC_ prefix, never a Docker build arg, never imported by a client
 * component. The `server-only` import above turns a mistake into a build error
 * rather than a leaked key.
 *
 * Called once, when an auction is created. Never on read — the result is stored
 * on the row (§10.5), because Distance Matrix bills per element and a feed that
 * recomputed distance on every render would be both slow and expensive.
 */

export type Route = {
  /** Driving distance, kilometres, 1 decimal place. */
  distanceKm: number;
  /** Driving time, whole minutes. */
  estimatedTimeMins: number;
};

export type RouteResult =
  | { ok: true; data: Route }
  | { ok: false; error: string };

export type LatLng = { lat: number; lng: number };

const ENDPOINT = "https://maps.googleapis.com/maps/api/distancematrix/json";
const TIMEOUT_MS = 10_000;

/** Metres → km, one decimal. */
export function metresToKm(metres: number): number {
  return Math.round(metres / 100) / 10;
}

/** Seconds → whole minutes. */
export function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

/** True when a server key is configured; false puts callers in degraded mode. */
export function isDistanceMatrixConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_SERVER_API_KEY);
}

/**
 * Map a Distance Matrix response to a Route or a user-facing message.
 *
 * Exported for unit tests: the two-level status check below is the part that
 * actually goes wrong, and it deserves tests that do not hit the network.
 *
 * BOTH status levels must be read. `json.status` reports whether the *request*
 * worked; `rows[0].elements[0].status` reports whether *this pair* is routable.
 * A response can be `status: "OK"` with an element status of `ZERO_RESULTS`, so
 * checking only the top level silently yields `distanceKm: undefined`.
 */
export function parseDistanceMatrix(json: unknown): RouteResult {
  // A null or non-object body reaches here whenever the response is not the
  // JSON we expect — an HTML error page from a proxy, for instance. Guard
  // before the property reads, or the action throws instead of returning a
  // message and the shipper loses the form they just filled in.
  if (json === null || typeof json !== "object") {
    return { ok: false, error: "Could not calculate the route. Please try again." };
  }

  const body = json as {
    status?: string;
    error_message?: string;
    rows?: Array<{
      elements?: Array<{
        status?: string;
        distance?: { value?: number };
        duration?: { value?: number };
      }>;
    }>;
  };

  switch (body.status) {
    case "OK":
      break;
    case "OVER_QUERY_LIMIT":
      return { ok: false, error: "Route lookup is busy right now. Please try again in a moment." };
    case "REQUEST_DENIED":
    case "INVALID_REQUEST":
    case undefined:
      // body.error_message can echo the key back — log it, never return it.
      console.error("[maps] Distance Matrix request rejected:", body.status, body.error_message);
      return { ok: false, error: "Could not calculate the route. Please try again." };
    default:
      console.error("[maps] Unexpected Distance Matrix status:", body.status);
      return { ok: false, error: "Could not calculate the route. Please try again." };
  }

  const element = body.rows?.[0]?.elements?.[0];
  if (!element) {
    return { ok: false, error: "Could not calculate the route. Please try again." };
  }

  if (element.status === "ZERO_RESULTS" || element.status === "NOT_FOUND") {
    return {
      ok: false,
      error:
        "We couldn't find a driving route between these locations. " +
        "Please check the pickup and drop-off points.",
    };
  }

  const metres = element.distance?.value;
  const seconds = element.duration?.value;
  if (element.status !== "OK" || typeof metres !== "number" || typeof seconds !== "number") {
    return { ok: false, error: "Could not calculate the route. Please try again." };
  }

  return {
    ok: true,
    data: { distanceKm: metresToKm(metres), estimatedTimeMins: secondsToMinutes(seconds) },
  };
}

/**
 * Resolve the driving route between two points.
 *
 * Returns `{ ok: false }` rather than throwing — the caller creates the auction
 * with null route fields regardless (§10.5), because a load with an unknown
 * distance is worth more to a shipper than no load at all.
 */
export async function resolveRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    return { ok: false, error: "Route lookup is not configured." };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("origins", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destinations", `${destination.lat},${destination.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "metric");
  url.searchParams.set("region", "in");
  url.searchParams.set("key", key);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("[maps] Distance Matrix HTTP", response.status);
      return { ok: false, error: "Could not reach the routing service. Please try again." };
    }

    return parseDistanceMatrix(await response.json());
  } catch (error) {
    console.error("[maps] Distance Matrix request failed:", error);
    return { ok: false, error: "Could not reach the routing service. Please try again." };
  }
}
