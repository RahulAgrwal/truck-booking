"use client";

import { useEffect, useRef, useState } from "react";

import { loadMapsLibrary } from "@/lib/maps-client";

/**
 * A small map preview of the load's route, shown once both ends are geocoded.
 *
 * Lives beside the create page rather than in `src/components/` because that
 * tree belongs to Lane B (BuildPlan.md §3) — the same reason
 * `LocationAutocomplete` needed an explicit carve-out. Nothing else uses it.
 *
 * Uses the *client* key via `@/lib/maps-client`. The distance shown to the user
 * does not come from here: it comes from the `previewRoute` Server Action, so
 * the number on screen is the same Distance Matrix figure the server will store
 * (CLAUDE.md §9 — the server key never reaches the browser).
 *
 * Drawing goes through `routes.Route.computeRoutes`, **not** `DirectionsService`
 * / `DirectionsRenderer`: those were deprecated on 25 Feb 2026 and calling them
 * logs a deprecation warning on every render of this screen.
 *
 * No marker library is imported. `AdvancedMarkerElement` requires a cloud-side
 * Map ID, and `google.maps.Marker` is deprecated too — so the endpoints are
 * drawn as polyline symbols instead, which needs neither. The addresses are
 * already spelled out in the two fields directly above the map, so its job is
 * to show the *shape* of the trip, not to label its ends.
 */

export type MapPoint = { lat: number; lng: number };

/** Zoom used before a route or bounds has been fitted. */
const INITIAL_ZOOM = 9;
/** CLAUDE.md §4.1 — safety orange for the route, brand brown for the endpoints. */
const ROUTE_COLOR = "#ff6b00";
const ENDPOINT_COLOR = "#a04100";

export function RouteMap({ pickup, dropoff }: { pickup: MapPoint; dropoff: MapPoint }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "route" | "straight" | "failed">("loading");

  const { lat: pLat, lng: pLng } = pickup;
  const { lat: dLat, lng: dLng } = dropoff;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    void (async () => {
      try {
        const [{ Map, Polyline }, { LatLngBounds }] = await Promise.all([
          loadMapsLibrary("maps"),
          loadMapsLibrary("core"),
        ]);

        if (cancelled) return;

        const origin = { lat: pLat, lng: pLng };
        const destination = { lat: dLat, lng: dLng };

        const map = new Map(container, {
          center: origin,
          zoom: INITIAL_ZOOM,
          disableDefaultUI: true,
          // One-finger drag must scroll the *page*, not pan the map. Without
          // this a map inside a scrolling form becomes a trap: the shipper
          // swipes to reach the submit button and just pans the map instead.
          gestureHandling: "cooperative",
          keyboardShortcuts: false,
          clickableIcons: false,
        });

        /** A filled dot at each end of whatever line we managed to draw. */
        const drawEndpoints = () => {
          for (const at of ["0%", "100%"]) {
            new Polyline({
              map,
              path: [origin, destination],
              strokeOpacity: 0,
              icons: [
                {
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 5,
                    fillColor: ENDPOINT_COLOR,
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                  },
                  offset: at,
                },
              ],
            });
          }
        };

        try {
          const { Route } = await loadMapsLibrary("routes");
          if (cancelled) return;

          const { routes } = await Route.computeRoutes({
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
            fields: ["path", "viewport"],
          });

          const best = routes?.[0];
          if (cancelled) return;
          if (!best?.path) throw new Error("No route returned");

          new Polyline({
            map,
            path: best.path,
            strokeColor: ROUTE_COLOR,
            strokeWeight: 5,
            strokeOpacity: 0.9,
          });

          if (best.viewport) map.fitBounds(best.viewport, 24);
          drawEndpoints();
          setStatus("route");
        } catch {
          // The Routes API is a separate SKU from Distance Matrix and may not be
          // enabled on the key. A straight line between the two points is still
          // a useful picture, and it is labelled as such rather than passed off
          // as the driving route.
          if (cancelled) return;

          new Polyline({
            map,
            path: [origin, destination],
            geodesic: true,
            strokeOpacity: 0,
            icons: [
              {
                icon: {
                  path: "M 0,-1 0,1",
                  strokeColor: ENDPOINT_COLOR,
                  strokeOpacity: 0.9,
                  scale: 3,
                },
                offset: "0",
                repeat: "12px",
              },
            ],
          });

          const bounds = new LatLngBounds();
          bounds.extend(origin);
          bounds.extend(destination);
          map.fitBounds(bounds, 32);
          drawEndpoints();
          setStatus("straight");
        }
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      // A Map left attached to a detached node holds its WebGL context; a few
      // of those in one session will drop the tab's renderer.
      container.replaceChildren();
    };
  }, [pLat, pLng, dLat, dLng]);

  if (status === "failed") {
    // No map, but the distance strip above still has the answer, so this is a
    // missing illustration rather than a missing fact — say so quietly.
    return (
      <p className="font-body-md text-body-md text-on-surface-variant">Map preview unavailable.</p>
    );
  }

  return (
    <div className="space-y-stack-sm">
      <div
        ref={containerRef}
        role="img"
        aria-label="Map of the route from the pickup to the drop-off location"
        className="h-[180px] w-full overflow-hidden rounded-lg border border-surface-variant bg-surface-container-low"
      />
      {status === "straight" ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Showing a direct line — the road route couldn&rsquo;t be drawn.
        </p>
      ) : null}
    </div>
  );
}
