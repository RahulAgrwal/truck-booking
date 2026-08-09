/**
 * Browser-side Maps JS API loader (TechnicalDocument.md §10.3).
 *
 * The counterpart to `src/lib/maps.ts`, which is `server-only` and holds the
 * Distance Matrix call. This file is the opposite: it runs in the browser and
 * therefore may only ever touch NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — the *client*
 * key, public by design and defended by HTTP-referrer restrictions.
 * GOOGLE_MAPS_SERVER_API_KEY must never appear here (CLAUDE.md §9).
 *
 * Why a module rather than a hook: the Maps script is a page-level singleton.
 * Two components wanting Maps — the address autocomplete and the route map —
 * must share one `<script>` and one in-flight promise, or the second one races
 * the first and Google logs "You have included the Maps JS API multiple times".
 */

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/** False when no client key is configured; callers degrade rather than throw. */
export const isMapsConfigured = Boolean(apiKey);

const SCRIPT_ID = "truckinggo-maps-js";
/** Global the Maps bootstrap calls once it has finished initialising. */
const READY_CALLBACK = "__truckinggoMapsReady";

declare global {
  interface Window {
    google?: typeof google;
    [READY_CALLBACK]?: () => void;
  }
}

let bootstrap: Promise<void> | null = null;

/**
 * Inject the Maps JS bootstrap exactly once and resolve when `importLibrary`
 * exists on `google.maps`.
 *
 * **Resolution is driven by `callback=`, not by `script.onload`**, and that
 * distinction is the whole function. `onload` fires when the bytes have run,
 * which is *before* the bootstrap has finished wiring up `google.maps` — so
 * `importLibrary` is reliably still undefined at that moment and the first
 * caller after it dies with "importLibrary is not a function". A few hundred
 * milliseconds later it exists, which is what makes the bug look intermittent.
 * The `callback` parameter is Google's designed answer: it fires once the API
 * is genuinely ready.
 */
function loadBootstrap(): Promise<void> {
  if (!apiKey) return Promise.reject(new Error("Maps API key is not configured"));
  // `typeof`, not truthiness: the Maps typings declare `importLibrary` as
  // always present on `google.maps`, so a bare check is a compile error (TS2774)
  // even though at runtime the whole namespace is absent until the script runs.
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve();
  if (bootstrap) return bootstrap;

  bootstrap = new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error("Maps JS API failed to load"));

    window[READY_CALLBACK] = () => resolve();

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // Someone else injected it and we are waiting on the same callback.
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    // `libraries=` primes the payloads this app uses, so the importLibrary
    // calls below resolve from cache rather than round-tripping.
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&v=weekly&libraries=places,maps,routes&loading=async&region=IN&language=en` +
      `&callback=${READY_CALLBACK}`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });

  // A rejected bootstrap must not be cached, or one transient network failure
  // disables Maps for the rest of the session.
  bootstrap.catch(() => {
    bootstrap = null;
  });

  return bootstrap;
}

/**
 * Await a Maps library by name.
 *
 * `script.onload` is **not** enough on its own. Under `loading=async` the
 * bootstrap defers the library payloads, so `window.google.maps.places` is
 * still undefined the instant the script finishes — reading a class off it
 * there yields `undefined`, which reads exactly like a bad API key and sends
 * callers into degraded mode with a perfectly valid one. The library has to be
 * awaited explicitly, and that is the whole reason this function exists.
 */
export async function loadMapsLibrary<K extends keyof MapsLibraries>(
  name: K,
): Promise<MapsLibraries[K]> {
  await loadBootstrap();
  return (await window.google!.maps.importLibrary(name)) as MapsLibraries[K];
}

/** The subset of Maps libraries this app imports. */
export type MapsLibraries = {
  places: google.maps.PlacesLibrary;
  maps: google.maps.MapsLibrary;
  core: google.maps.CoreLibrary;
  routes: google.maps.RoutesLibrary;
};
