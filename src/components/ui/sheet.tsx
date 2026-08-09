"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/design/cn";

/**
 * Sheet (TechnicalDocument.md §6.2) — the confirmation surface for every
 * irreversible action: submit bid, accept bid, sign out (§7.6).
 *
 * **It slides from the bottom. A centred modal is a bug**, not a variation:
 * the confirm button has to land in the thumb zone, and a dialog floating in
 * the middle of a phone screen puts it exactly where the thumb is not.
 *
 * Not a `<dialog>`: `showModal()` centres by UA stylesheet and its backdrop
 * sits outside the token system, so both would have to be fought. A plain
 * fixed overlay with the four modal behaviours implemented explicitly is less
 * code than the overrides.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Sticky action row. Put the confirm button here — it is thumb-reachable. */
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes. Registered only while open so a stacked sheet can't be
  // closed by a listener belonging to a sheet underneath it.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /*
    Lock the page behind the sheet. Without this it scrolls under the overlay,
    which reads as the sheet itself drifting.

    **`documentElement`, not `body`.** The root element's overflow is what
    propagates to the viewport, so `<html>` is the actual scroller and setting
    `overflow: hidden` on `<body>` locks nothing — it only turns body into a
    second scroll container that can never scroll, because its height is its
    content height. That is the same mechanism that broke page scrolling
    outright in globals.css (docs/progress-A.md), seen from the other side.

    Cleanup restores the previous inline value, which is normally "", letting
    the stylesheet's own `html { overflow-x: hidden }` take back over.
  */
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  // Move focus in, so the next Tab lands inside the sheet rather than on the
  // page behind it.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    // z-60: above the app bar and bottom nav, which are both z-50 (§7.1).
    <div className="fixed inset-0 z-60 flex flex-col justify-end">
      {/*
        Backdrop. A div rather than a <button>: it is a redundant way to do what
        Escape and the close button already do, so announcing it to a screen
        reader would just add noise.
      */}
      <div
        className="absolute inset-0 bg-inverse-surface/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative w-full rounded-t-xl bg-surface-container-lowest outline-none",
          "shadow-[0_-4px_16px_rgba(0,0,0,0.12)] animate-sheet-up",
          // Never taller than the screen, and clear of the home indicator.
          "max-h-[85dvh] overflow-y-auto pb-safe",
        )}
      >
        {/* Grab handle — the affordance that says "this came from the bottom". */}
        <div className="flex justify-center pt-stack-sm" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-surface-variant" />
        </div>

        <div className="flex flex-col gap-stack-sm px-margin-mobile pt-stack-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
          {description ? (
            <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
          ) : null}
        </div>

        {children ? <div className="px-margin-mobile pt-stack-md">{children}</div> : null}

        {footer ? (
          <div className="sticky bottom-0 mt-stack-lg bg-surface-container-lowest px-margin-mobile pt-stack-sm pb-stack-md">
            {footer}
          </div>
        ) : (
          <div className="pb-stack-md" />
        )}
      </div>
    </div>
  );
}
