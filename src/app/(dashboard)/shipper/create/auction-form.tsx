"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { LocationAutocomplete, type LocationValue } from "@/components/LocationAutocomplete";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { calculateRouteAndCreateAuction, previewRoute } from "@/lib/actions/auction";
import { formatRouteSummary } from "@/lib/design/feed";
import { AUCTION_DURATIONS_HOURS } from "@/lib/schemas";
import { RouteMap } from "@/components/route-map";
import { cn } from "@/lib/design/cn";

const EMPTY: LocationValue = { address: "", lat: null, lng: null };

/** What the route strip is showing right now. */
type RoutePreview =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; distanceKm: number; estimatedTimeMins: number }
  | { state: "error"; message: string };

/** A resolved lookup, tagged with the coordinate pair it answers. */
type RouteAnswer = { key: string } & (
  | { state: "ready"; distanceKm: number; estimatedTimeMins: number }
  | { state: "error"; message: string }
);

/** Identifies a pickup/drop-off pair; null until both ends are geocoded. */
function routeKey(
  pLat: number | null, pLng: number | null,
  dLat: number | null, dLng: number | null,
): string | null {
  if (pLat === null || pLng === null || dLat === null || dLng === null) return null;
  return `${pLat},${pLng}|${dLat},${dLng}`;
}

export function AuctionForm() {
  const router = useRouter();
  const [pickup, setPickup] = useState<LocationValue>(EMPTY);
  const [dropoff, setDropoff] = useState<LocationValue>(EMPTY);
  const [material, setMaterial] = useState("");
  const [weight, setWeight] = useState("");
  const [duration, setDuration] = useState<(typeof AUCTION_DURATIONS_HOURS)[number]>(6);

  const [answer, setAnswer] = useState<RouteAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { lat: pLat, lng: pLng } = pickup;
  const { lat: dLat, lng: dLng } = dropoff;

  const key = routeKey(pLat, pLng, dLat, dLng);

  /*
    Resolve the route whenever both ends are geocoded. Keying on the four
    coordinates rather than the two objects is what keeps this from re-billing:
    typing in a field nulls its coordinates (LocationAutocomplete does that
    deliberately), so the lookup only re-runs on an actual new pair.

    Nothing is set synchronously here — "idle" and "loading" are *derived*
    below, not stored. Storing them would mean a setState in the effect body and
    a cascading render on every keystroke that clears a coordinate.
  */
  useEffect(() => {
    if (key === null || pLat === null || pLng === null || dLat === null || dLng === null) return;

    let cancelled = false;

    void (async () => {
      const result = await previewRoute({
        pickupLat: pLat,
        pickupLng: pLng,
        dropoffLat: dLat,
        dropoffLng: dLng,
      });
      // A slow lookup must not overwrite a newer pair's answer.
      if (cancelled) return;
      setAnswer(
        result.ok
          ? { key, state: "ready", ...result.data }
          : { key, state: "error", message: result.error },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [key, pLat, pLng, dLat, dLng]);

  // Derived, so a stale answer for a previous pair can never be shown: it is
  // either the answer to the pair on screen, or we are still waiting for one.
  const route: RoutePreview =
    key === null
      ? { state: "idle" }
      : answer?.key === key
        ? answer
        : { state: "loading" };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    startTransition(async () => {
      const result = await calculateRouteAndCreateAuction({
        pickupLocation: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLocation: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        materialDetails: material,
        weightTons: weight,
        durationHours: duration,
      });

      if (!result.ok) {
        setError(result.error);
        setFieldError(result.field ?? null);
        return;
      }

      // The auction exists either way; a failed route lookup is a warning, not
      // a failure, so it rides along to the detail screen.
      const query = result.data.routeWarning ? "?routeWarning=1" : "";
      router.replace(`/shipper/auction/${result.data.id}${query}`);
    });
  }

  const errorFor = (name: string) => (fieldError === name && error ? error : undefined);

  return (
    /*
      A real flex column, not `display: contents`.

      `contents` removed the form's box, which had two consequences: AppScreen's
      `space-y-*` selects `main > * + *` and so only ever saw the <form> — the
      sections below got no vertical rhythm at all — and a box with no layout
      cannot carry the bottom padding that clears the sticky footer. Both are
      fixed by the form simply being a box.

      The bottom padding is a §3.3-sanctioned fixed-bar offset: 16 + 56 (the lg
      button) + 16 of footer, plus the home indicator, plus a little air.
    */
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-stack-lg pb-[calc(env(safe-area-inset-bottom,0px)+112px)]"
    >
      <section className="bg-surface-container-lowest p-gutter-mobile rounded-xl border border-surface-variant shadow-sm">
        <div className="space-y-stack-md">
          <LocationAutocomplete
            label="Pickup Location"
            placeholder="City or area"
            icon="location_on"
            iconClassName="text-primary"
            value={pickup}
            onChange={setPickup}
            error={errorFor("pickupLocation")}
            required
          />
          <LocationAutocomplete
            label="Drop-off Location"
            placeholder="City or area"
            icon="flag"
            iconClassName="text-tertiary"
            value={dropoff}
            onChange={setDropoff}
            error={errorFor("dropoffLocation")}
            required
          />
          <RouteStrip route={route} />

          {/*
            Keyed on the pair so a new pickup or drop-off rebuilds the map
            rather than mutating the old one — cheaper to reason about than
            diffing renderers, and the effect's cleanup disposes the previous
            instance. Only mounted once both ends are geocoded.
          */}
          {pLat !== null && pLng !== null && dLat !== null && dLng !== null ? (
            <RouteMap
              key={key ?? undefined}
              pickup={{ lat: pLat, lng: pLng }}
              dropoff={{ lat: dLat, lng: dLng }}
            />
          ) : null}
        </div>
      </section>

      <section className="bg-surface-container-lowest p-gutter-mobile rounded-xl border border-surface-variant shadow-sm space-y-stack-md">
        <Textarea
          label="Material Description"
          placeholder="e.g. Steel Coils"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          error={errorFor("materialDetails")}
          required
        />
        <Input
          label="Weight"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0.1"
          max="100"
          placeholder="5"
          suffix="Tons"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          error={errorFor("weightTons")}
          hint="Stored in kilograms — 1 Ton = 1,000 kg."
          required
        />
      </section>

      <section className="space-y-stack-sm">
        <span className="block font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
          Auction Duration
        </span>
        {/*
          A radiogroup, not four independent buttons: exactly one is chosen, and
          screen readers should say so. Four across fits 390px at ≥48px tall.
        */}
        <div role="radiogroup" aria-label="Auction duration" className="grid grid-cols-4 gap-gutter-mobile">
          {AUCTION_DURATIONS_HOURS.map((hours) => {
            const selected = duration === hours;
            return (
              <button
                key={hours}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDuration(hours)}
                className={cn(
                  "h-touch-target-min rounded-lg border font-label-bold text-label-bold",
                  "flex items-center justify-center transition-colors active:scale-95",
                  selected
                    ? "border-primary bg-primary-fixed text-primary"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface-variant",
                )}
              >
                {hours}h
              </button>
            );
          })}
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Carriers can bid until the timer runs out. You can accept a bid at any time before then.
        </p>
      </section>

      {error && !fieldError ? (
        <p role="alert" className="font-body-md text-body-md text-error">
          {error}
        </p>
      ) : null}

      {/*
        Sticky footer CTA. This submit is slower than a plain insert — it waits
        on Distance Matrix — so the loading state is required, not decorative.
      */}
      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-outline-variant bg-surface pb-safe">
        <div className="p-margin-mobile">
          <Button type="submit" size="lg" fullWidth loading={pending}>
            {pending ? "Calculating route…" : "Start Auction Now"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * The inset route readout under the two address fields.
 *
 * Renders nothing at all when idle. An empty strip sitting there before either
 * address is picked would be a promise the form cannot keep yet — the row
 * appears the moment there is a real answer to put in it.
 *
 * `aria-live="polite"` because the value arrives after the shipper has moved on
 * to the next field; without it the distance changes silently.
 */
function RouteStrip({ route }: { route: RoutePreview }) {
  if (route.state === "idle") return null;

  const isError = route.state === "error";

  return (
    <div
      aria-live="polite"
      className={cn(
        "flex items-center gap-stack-sm rounded p-stack-sm",
        isError ? "bg-error-container" : "bg-surface-container-low",
      )}
    >
      <span
        className={cn(
          "material-symbols-outlined shrink-0",
          isError ? "text-on-error-container" : "text-on-surface-variant",
        )}
        style={{ fontSize: "20px" }}
        aria-hidden="true"
      >
        {isError ? "error" : "route"}
      </span>

      {route.state === "loading" ? (
        <span className="font-body-md text-body-md text-on-surface-variant">
          Calculating distance…
        </span>
      ) : route.state === "error" ? (
        <span className="font-body-md text-body-md text-on-error-container">{route.message}</span>
      ) : (
        <span className="font-body-md text-body-md text-on-surface">
          {formatRouteSummary(route.distanceKm, route.estimatedTimeMins)}
        </span>
      )}
    </div>
  );
}
