"use client";

import { useId, useState } from "react";

import { RouteMap, type MapPoint } from "@/components/route-map";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/design/cn";

/**
 * "View route" — a collapsed disclosure that mounts a `RouteMap` on tap.
 *
 * OWNERSHIP: Lane A, inside Lane B's `src/components/**` tree — the same
 * carve-out as `route-map.tsx` and `LocationAutocomplete.tsx` (BuildPlan.md §3).
 *
 * Collapsed by default, for two reasons that both matter more than glanceability:
 *
 * 1. **The CTA stays above the fold.** The carrier's bid screen holds only the
 *    summary card and the bid form — about 650px, so at 375×667 the ₹ input and
 *    the sticky *Submit Bid* button are reachable without scrolling. Rendering
 *    the 180px map inline pushes it to ~830px and buries the one action the
 *    screen exists for.
 * 2. **Billing.** TechnicalDocument.md §10.5 says route data is resolved once at
 *    creation and never recomputed on read. A map drawn on every open would be
 *    one `Route.computeRoutes` call per carrier per load browsed. Behind a tap
 *    it costs a call only when someone actually wants the picture.
 *
 * `RouteMap` is rendered only while open, so no Maps script is injected at all
 * until the first tap — that is the whole point, not an optimisation.
 *
 * Collapsing unmounts the map, so re-expanding does bill a second lookup. The
 * alternative — keeping it mounted under `display: none` — invites sizing bugs
 * when it comes back, and `RouteMap`'s cleanup already disposes the WebGL
 * context properly. Unmounting is the safe trade.
 */
export function RouteMapDisclosure({
  pickup,
  dropoff,
  label = "View route",
}: {
  pickup: MapPoint;
  dropoff: MapPoint;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="space-y-stack-sm">
      <button
        type="button"
        onClick={() => setOpen((it) => !it)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex h-touch-target-min w-full items-center gap-stack-sm rounded-lg border px-margin-mobile",
          "border-outline-variant bg-surface-container-lowest",
          "font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant",
          "transition-transform active:scale-[0.98]",
        )}
      >
        <Icon name="map" className="text-[20px] text-primary" />
        <span className="flex-1 text-left">{label}</span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-[20px]" />
      </button>

      <div id={panelId}>
        {open ? <RouteMap pickup={pickup} dropoff={dropoff} /> : null}
      </div>
    </div>
  );
}
