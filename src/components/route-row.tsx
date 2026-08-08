import { cn } from "@/lib/design/cn";

import { Icon } from "./ui/icon";

/**
 * Origin → destination.
 *
 * Two orientations, because the two Stitch screens draw the same data
 * differently and both are canonical:
 *
 * - `horizontal` — Shipper Dashboard (`2a58c34e…`): city, hairline connector
 *   with a centred arrow, city. The CLAUDE.md §4.4 recipe.
 * - `vertical` — Carrier Load Feed (`36d28947…`): a rail of two markers joined
 *   by a dashed line, with the cities (and their times) stacked beside it.
 */
export function RouteRow({
  from,
  to,
  orientation = "horizontal",
  fromMeta,
  toMeta,
  className,
}: {
  from: string;
  to: string;
  orientation?: "horizontal" | "vertical";
  /** e.g. "Pickup: Today, 14:00" — vertical orientation only. */
  fromMeta?: string;
  toMeta?: string;
  className?: string;
}) {
  if (orientation === "vertical") {
    return (
      <div className={cn("flex gap-3 py-2", className)}>
        <div className="relative flex w-6 shrink-0 flex-col items-center py-1">
          <Icon
            name="radio_button_checked"
            filled
            className="z-10 bg-surface-container-lowest text-[20px] text-primary"
          />
          {/*
            Dashed rail. A repeating linear-gradient rather than a border-dashed
            element: it keeps the dash rhythm fixed regardless of how far apart
            the two markers end up.
          */}
          <div
            className="absolute top-3 bottom-3 left-1/2 w-[2px] -translate-x-1/2 bg-[linear-gradient(to_bottom,var(--color-primary)_50%,transparent_0%)] bg-[length:2px_8px] bg-repeat-y"
            aria-hidden="true"
          />
          <Icon
            name="location_on"
            filled
            className="z-10 mt-auto bg-surface-container-lowest text-[20px] text-secondary"
          />
        </div>

        <div className="flex flex-1 flex-col justify-between gap-6">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">{from}</h3>
            {fromMeta ? (
              <p className="font-body-md text-body-md text-on-surface-variant">{fromMeta}</p>
            ) : null}
          </div>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">{to}</h3>
            {toMeta ? (
              <p className="font-body-md text-body-md text-on-surface-variant">{toMeta}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center justify-between", className)}>
      <span className="font-headline-md text-headline-md text-on-surface">{from}</span>

      <div className="relative flex flex-1 items-center justify-center px-4">
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-outline" aria-hidden="true" />
        {/*
          The arrow sits on the line, so it needs the card's own background to
          punch a hole through it — hence the explicit surface colour here.
        */}
        <Icon
          name="arrow_right_alt"
          filled
          className="z-10 bg-surface-container-lowest px-1 text-outline"
        />
      </div>

      <span className="text-right font-headline-md text-headline-md text-on-surface">{to}</span>
    </div>
  );
}
