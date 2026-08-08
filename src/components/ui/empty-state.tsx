import type { ReactNode } from "react";

import { cn } from "@/lib/design/cn";

import { ButtonLink } from "./button";
import { Icon } from "./icon";

/**
 * EmptyState (TechnicalDocument.md §6.2) — required on every list (§7.5).
 *
 * `icon`, `title` and `body` are all mandatory. An empty list with no
 * explanation is indistinguishable from a broken one, and CLAUDE.md §6 counts
 * a screen without its empty state as unfinished.
 */
export function EmptyState({
  icon,
  title,
  body,
  cta,
  className,
}: {
  /** Material Symbols ligature, e.g. `local_shipping`. */
  icon: string;
  title: string;
  body: string;
  /** Give the user somewhere to go — shipper: "Post a Load". */
  cta?: { label: string; href: string } | ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-stack-md px-margin-mobile py-stack-lg text-center",
        className,
      )}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
        <Icon name={icon} className="text-3xl text-on-surface-variant" />
      </span>

      <div className="flex flex-col gap-stack-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{body}</p>
      </div>

      {isCtaLink(cta) ? (
        <ButtonLink href={cta.href} variant="primary" size="md">
          {cta.label}
        </ButtonLink>
      ) : (
        cta
      )}
    </div>
  );
}

function isCtaLink(cta: unknown): cta is { label: string; href: string } {
  return (
    typeof cta === "object" &&
    cta !== null &&
    "href" in cta &&
    "label" in cta &&
    typeof (cta as { href: unknown }).href === "string"
  );
}

/**
 * The error counterpart, for every `error.tsx`. `reset` is the boundary's own
 * retry. §7.5: a plain message and a way out — never a raw stack.
 */
export function ErrorState({
  title = "Something went wrong",
  body = "That didn't load. It's usually temporary.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-stack-md px-margin-mobile py-stack-lg text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container">
        <Icon name="error" className="text-3xl text-on-error-container" />
      </span>

      <div className="flex flex-col gap-stack-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{body}</p>
      </div>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-touch-target-min items-center justify-center rounded-lg bg-primary-container px-stack-md font-body-lg text-body-lg text-on-primary-container transition-transform active:scale-95"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
