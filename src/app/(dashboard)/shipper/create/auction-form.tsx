"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LocationAutocomplete, type LocationValue } from "@/components/LocationAutocomplete";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { calculateRouteAndCreateAuction } from "@/lib/actions/auction";
import { AUCTION_DURATIONS_HOURS } from "@/lib/schemas";
import { cn } from "@/lib/design/cn";

const EMPTY: LocationValue = { address: "", lat: null, lng: null };

export function AuctionForm() {
  const router = useRouter();
  const [pickup, setPickup] = useState<LocationValue>(EMPTY);
  const [dropoff, setDropoff] = useState<LocationValue>(EMPTY);
  const [material, setMaterial] = useState("");
  const [weight, setWeight] = useState("");
  const [duration, setDuration] = useState<(typeof AUCTION_DURATIONS_HOURS)[number]>(6);

  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    <form onSubmit={handleSubmit} className="contents">
      <section className="bg-surface-container-lowest p-stack-md rounded-xl border border-surface-variant shadow-sm">
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
        </div>
      </section>

      <section className="bg-surface-container-lowest p-stack-md rounded-xl border border-surface-variant shadow-sm space-y-stack-md">
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
