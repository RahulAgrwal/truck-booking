"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/design/cn";

/**
 * Input (TechnicalDocument.md §6.2).
 *
 * `"use client"` for `useId` — every screen that uses an input is a form with
 * local state, which CLAUDE.md §3.2 already puts on the client.
 *
 * Two non-negotiables:
 * - `h-touch-target-min` (48px).
 * - **16px text.** Anything smaller and iOS Safari zooms the viewport on focus,
 *   which on a `maximum-scale=1` PWA leaves the user stuck at the wrong scale.
 *   That is why the class is `text-body-lg` and not `text-body-md`.
 */

type InputOwnProps = {
  label: string;
  /** Server Action field error — from `ActionResult`'s `field` key (§7.6). */
  error?: string;
  /** Leading adornment, e.g. `₹`. */
  prefix?: ReactNode;
  /** Trailing adornment, e.g. `Tons`. */
  suffix?: ReactNode;
  /** Hint under the field. Hidden while an error is showing. */
  hint?: string;
  className?: string;
};

export type InputProps = InputOwnProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof InputOwnProps>;

export function Input({
  label,
  error,
  prefix,
  suffix,
  hint,
  className,
  id,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;

  return (
    <div className={cn("flex flex-col gap-stack-sm", className)}>
      <label htmlFor={inputId} className="font-label-bold text-label-bold text-on-surface-variant">
        {label}
      </label>

      <div
        className={cn(
          "flex h-touch-target-min items-center gap-stack-sm rounded-lg border px-stack-md",
          "bg-surface-container-lowest",
          // Focus lives on the wrapper so the ring surrounds the adornments too.
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-fixed",
          error ? "border-error" : "border-surface-variant",
        )}
      >
        {prefix ? (
          <span className="font-body-lg text-body-lg text-on-surface-variant shrink-0">{prefix}</span>
        ) : null}

        <input
          id={inputId}
          // Colour is not the only error signal: aria-invalid + the message below.
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn(
            // `h-full` is a tap-target fix, not cosmetics. The wrapper is 48px
            // and centres its children, so an auto-height input is 24px with a
            // 12px dead strip above and below it: the field *looks* 48px but a
            // tap on its top edge hits the wrapper div and focuses nothing.
            // Measured at 390×844 before the fix — elementFromPoint 6px below
            // the border returned the DIV. CLAUDE.md §3.1 means the thing you
            // can actually hit, not the thing you can see.
            "h-full min-w-0 flex-1 bg-transparent font-body-lg text-body-lg text-on-surface",
            "placeholder:text-on-surface-variant focus:outline-none",
          )}
          {...rest}
        />

        {suffix ? (
          <span className="font-body-md text-body-md text-on-surface-variant shrink-0">{suffix}</span>
        ) : null}
      </div>

      {error ? (
        <p id={messageId} role="alert" className="font-label-bold text-label-bold text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="font-body-md text-body-md text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Multi-line variant for the material-details field. Same shell, auto-height,
 * so it does not carry the fixed 48px.
 */
export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  rows = 3,
  ...rest
}: Omit<InputOwnProps, "prefix" | "suffix"> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof InputOwnProps>) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-message`;

  return (
    <div className={cn("flex flex-col gap-stack-sm", className)}>
      <label htmlFor={textareaId} className="font-label-bold text-label-bold text-on-surface-variant">
        {label}
      </label>

      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(
          "w-full rounded-lg border bg-surface-container-lowest p-stack-md",
          "font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed",
          error ? "border-error" : "border-surface-variant",
        )}
        {...rest}
      />

      {error ? (
        <p id={messageId} role="alert" className="font-label-bold text-label-bold text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="font-body-md text-body-md text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
