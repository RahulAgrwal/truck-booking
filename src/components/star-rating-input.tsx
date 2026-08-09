"use client";

import { useId } from "react";

import { cn } from "@/lib/design/cn";

/**
 * The interactive half of the rating pair — five taps, one score.
 *
 * Built on **native `<input type="radio">`** rather than `role="radio"` buttons
 * and a roving tabindex. The native control already gives arrow-key navigation,
 * the correct screen-reader announcement, and form semantics; re-implementing
 * those by hand is how a star picker ends up unreachable from a keyboard. The
 * inputs are `sr-only` and the star is drawn by the label, which is what makes
 * each target a full 48px square instead of a 16px glyph.
 *
 * §7.7 — the chosen score is never signalled by fill alone: the word underneath
 * ("Excellent") changes with it.
 */

const WORDS = ["Terrible", "Poor", "OK", "Good", "Excellent"] as const;

export function StarRatingInput({
  value,
  onChange,
  legend,
  disabled = false,
  className,
}: {
  /** 0 = nothing chosen yet. */
  value: number;
  onChange: (stars: number) => void;
  /** What is being rated, e.g. "Rate Rajesh Transport". Announced, not drawn. */
  legend: string;
  disabled?: boolean;
  className?: string;
}) {
  const name = useId();

  return (
    <fieldset className={cn("flex flex-col items-center gap-stack-sm", className)} disabled={disabled}>
      <legend className="sr-only">{legend}</legend>

      <div className="flex items-center justify-center">
        {WORDS.map((word, index) => {
          const stars = index + 1;
          const on = stars <= value;

          return (
            <label
              key={stars}
              className={cn(
                "flex h-touch-target-min w-touch-target-min cursor-pointer items-center justify-center",
                "rounded-full transition-transform active:scale-95",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={stars}
                checked={stars === value}
                onChange={() => onChange(stars)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "material-symbols-outlined text-[32px]",
                  on ? "text-primary" : "text-outline-variant",
                  // The focus ring has to live here: the input itself is sr-only,
                  // so keyboard focus would otherwise be invisible.
                  "rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-primary",
                )}
                style={{ fontVariationSettings: `'FILL' ${on ? 1 : 0}` }}
                aria-hidden="true"
              >
                star
              </span>
              <span className="sr-only">
                {stars} {stars === 1 ? "star" : "stars"} — {word}
              </span>
            </label>
          );
        })}
      </div>

      {/*
        Reserved height, so choosing a score does not shift the sheet's contents
        under the user's thumb between the tap and the submit.
      */}
      <p
        className="h-5 font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant"
        aria-hidden="true"
      >
        {value > 0 ? WORDS[value - 1] : "Tap a star"}
      </p>
    </fieldset>
  );
}
