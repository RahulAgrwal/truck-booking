"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/design/cn";

/**
 * Google Places Autocomplete, restricted to India (TechnicalDocument.md §10.3).
 *
 * OWNERSHIP: this file sits in Lane B's `src/components/**` tree but is owned by
 * **Lane A** (BuildPlan.md §3) — it is used only by the shipper's create-auction
 * form, and gating A4 on a Lane B step would serialise the lanes for nothing.
 *
 * Uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — the *client* key, public by design and
 * defended by HTTP-referrer restrictions. The server key never appears here.
 *
 * The Maps JS API is loaded by hand rather than via a wrapper package: one
 * `<script>` and a promise is less code than the dependency would be, and it
 * keeps `package.json` untouched.
 *
 * Layout follows the patterns that work on phones: a leading pin per row, a
 * bold main line over a muted secondary line, the typed substring highlighted,
 * Google attribution (required by their terms when predictions are shown
 * without a Google map), and a "use what I typed" escape hatch.
 */

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  /** [start, end) offsets into mainText that matched what the user typed. */
  match: [number, number] | null;
};

export type LocationValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

const DEBOUNCE_MS = 250;
/** Four rows keeps the list clear of the on-screen keyboard at 390×844. */
const MAX_SUGGESTIONS = 4;

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
export const isPlacesConfigured = Boolean(apiKey);

// ---- Maps JS loader (module-scoped so it runs at most once per page) ----

declare global {
  interface Window {
    google?: typeof google;
  }
}

let loader: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (!apiKey) return Promise.reject(new Error("Maps API key is not configured"));
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    if (window.google?.maps?.places) return resolve();

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&libraries=places&loading=async&region=IN&language=en`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load the Maps JS API"));
    script.onload = () => resolve();
    document.head.appendChild(script);
  });

  return loader;
}

// ---- Component ----

export function LocationAutocomplete({
  label,
  placeholder,
  icon,
  iconClassName,
  value,
  onChange,
  error,
  required,
}: {
  label: string;
  placeholder?: string;
  /** Material Symbols name, e.g. "location_on". */
  icon: string;
  iconClassName?: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  error?: string;
  required?: boolean;
}) {
  const inputId = useId();
  const listId = `${inputId}-listbox`;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [degraded, setDegraded] = useState(!isPlacesConfigured);

  // Session tokens bill a whole autocomplete session as one lookup, so the
  // per-keystroke requests are not each charged as a separate search.
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);

  // Close on outside tap — on a phone this is the usual way out of the list.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    try {
      await loadMaps();
      const places = window.google?.maps?.places;
      if (!places?.AutocompleteSuggestion) {
        setDegraded(true);
        return;
      }

      sessionToken.current ??= new places.AutocompleteSessionToken();

      const { suggestions: results } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionToken.current,
          includedRegionCodes: ["in"], // India only
          language: "en",
        });

      const mapped: Suggestion[] = [];
      for (const item of results.slice(0, MAX_SUGGESTIONS)) {
        const prediction = item.placePrediction;
        if (!prediction) continue;
        const main = prediction.mainText;
        const matchRange = main?.matches?.[0];
        mapped.push({
          placeId: prediction.placeId,
          mainText: main?.text ?? prediction.text?.text ?? "",
          secondaryText: prediction.secondaryText?.text ?? "",
          match:
            matchRange && typeof matchRange.startOffset === "number"
              ? [matchRange.startOffset, matchRange.endOffset ?? matchRange.startOffset]
              : null,
        });
      }

      setSuggestions(mapped);
      setOpen(mapped.length > 0);
      setActiveIndex(-1);
    } catch (cause) {
      // A missing key, a referrer rejection or billing not enabled all land
      // here. Degrade to a plain text box rather than trapping the user.
      console.error("[LocationAutocomplete]", cause);
      setDegraded(true);
      setOpen(false);
    }
  }, []);

  function handleInput(next: string) {
    // Typing invalidates any previously picked coordinates — the text no longer
    // describes the place we geocoded.
    onChange({ address: next, lat: null, lng: null });

    if (degraded) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void fetchSuggestions(next), DEBOUNCE_MS);
  }

  async function handleSelect(suggestion: Suggestion) {
    const label = [suggestion.mainText, suggestion.secondaryText].filter(Boolean).join(", ");
    setOpen(false);
    setSuggestions([]);

    try {
      const places = window.google?.maps?.places;
      if (!places?.Place) {
        onChange({ address: label, lat: null, lng: null });
        return;
      }

      const place = new places.Place({ id: suggestion.placeId });
      await place.fetchFields({ fields: ["location", "formattedAddress"] });

      // The Places response already carries coordinates — a separate Geocoder
      // call here would be a second billable request for data we have.
      const location = place.location;
      onChange({
        address: place.formattedAddress ?? label,
        lat: location?.lat() ?? null,
        lng: location?.lng() ?? null,
      });
    } catch (cause) {
      console.error("[LocationAutocomplete] place details", cause);
      onChange({ address: label, lat: null, lng: null });
    } finally {
      // One token per completed session; the next search starts a new one.
      sessionToken.current = null;
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const chosen = suggestions[activeIndex];
      if (chosen) void handleSelect(chosen);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <label
        htmlFor={inputId}
        className="block font-label-bold text-label-bold text-on-surface-variant mb-stack-sm uppercase tracking-wider"
      >
        {label}
      </label>

      <div className="relative flex items-center">
        <span
          className={cn("material-symbols-outlined absolute left-3 z-10", iconClassName ?? "text-primary")}
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          required={required}
          value={value.address}
          placeholder={placeholder}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          className={cn(
            "w-full h-touch-target-min pl-10 pr-4 rounded-lg border bg-surface-container-lowest",
            "font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant",
            "focus:border-primary focus:outline-none transition-colors",
            error ? "border-error" : "border-outline-variant",
          )}
        />
      </div>

      {error ? (
        <p className="mt-stack-sm font-body-md text-body-md text-error" role="alert">
          {error}
        </p>
      ) : null}

      {/*
        Degraded mode. With no Maps key — which is the state both build lanes
        run in — this is a plain text box. The form still submits; the auction
        is created with null coordinates and no distance (§10.5).
      */}
      {degraded && value.address.length > 0 ? (
        <p className="mt-stack-sm font-body-md text-body-md text-on-surface-variant">
          Address suggestions are unavailable — type the city and state.
        </p>
      ) : null}

      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-stack-sm w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-[0_4px_12px_rgba(0,33,83,0.08)]"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placeId} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                // Pointer-down, not click: on mobile the input blurs first and
                // a click handler would fire after the list has already closed.
                onPointerDown={(e) => { e.preventDefault(); void handleSelect(suggestion); }}
                className={cn(
                  "flex w-full items-start gap-stack-sm px-margin-mobile py-stack-sm text-left",
                  "min-h-touch-target-min border-b border-surface-variant last:border-b-0",
                  "active:bg-surface-container-low transition-colors",
                  index === activeIndex && "bg-surface-container-low",
                )}
              >
                <span
                  className="material-symbols-outlined shrink-0 text-on-surface-variant"
                  style={{ fontSize: "20px" }}
                  aria-hidden="true"
                >
                  location_on
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body-lg text-body-lg text-on-surface">
                    <Highlight text={suggestion.mainText} match={suggestion.match} />
                  </span>
                  {suggestion.secondaryText ? (
                    <span className="block truncate font-body-md text-body-md text-on-surface-variant">
                      {suggestion.secondaryText}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}

          {/*
            Google's terms require attribution when Places predictions are shown
            outside a Google map. Also an escape hatch: nothing here matches, so
            keep what was typed — coordinates stay null and the auction is still
            creatable.
          */}
          <li className="flex items-center justify-between gap-stack-sm border-t border-surface-variant px-margin-mobile py-stack-sm">
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); setOpen(false); }}
              className="font-label-bold text-label-bold text-primary underline"
            >
              Use what I typed
            </button>
            <span className="font-label-bold text-label-bold text-on-surface-variant">
              powered by Google
            </span>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** Bolds the part of the suggestion that matched what was typed. */
function Highlight({ text, match }: { text: string; match: [number, number] | null }) {
  if (!match) return <>{text}</>;
  const [start, end] = match;
  if (start < 0 || end > text.length || start >= end) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <span className="font-headline-md text-body-lg text-primary">{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  );
}
