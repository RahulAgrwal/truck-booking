import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/design/cn";

/**
 * Button (TechnicalDocument.md §6.2).
 *
 * No `"use client"`. This renders markup and forwards props; it inherits the
 * environment of whoever imports it, so a form in a Server Component and a
 * client screen with an `onClick` both work (CLAUDE.md §3.2).
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  // The safety orange. This is the app's only "go" button.
  primary: "bg-primary-container text-on-primary-container active:bg-primary",
  secondary: "bg-secondary-container text-on-surface active:bg-secondary-fixed-dim",
  ghost: "bg-transparent text-primary active:bg-primary-fixed",
  destructive: "bg-error text-on-error active:bg-on-error-container",
};

const SIZE: Record<ButtonSize, string> = {
  // Never below the 48px floor (CLAUDE.md §3.1).
  md: "h-touch-target-min px-stack-md font-body-lg text-body-lg rounded-lg",
  // The sticky-footer size: full-width h-14, thumb-reachable.
  lg: "h-14 px-stack-md font-headline-md text-headline-md rounded-lg",
};

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Rendered before the label, already spaced. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: Pick<ButtonOwnProps, "variant" | "size" | "fullWidth" | "className">) {
  return cn(
    "inline-flex items-center justify-center gap-stack-sm text-center",
    "transition-transform active:scale-95",
    // A disabled control must still look disabled without moving.
    "disabled:opacity-50 disabled:active:scale-100 disabled:pointer-events-none",
    VARIANT[variant],
    SIZE[size],
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps>;

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  icon,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      // A loading button that stays clickable submits twice.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

/**
 * The same surface as a link. Separate from `Button` rather than a union on
 * `href`, so the DOM props stay correctly typed for each element.
 */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon,
  children,
  className,
}: ButtonOwnProps & { href: string }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, className })}>
      {icon}
      {children}
    </Link>
  );
}

/**
 * Border-trick spinner — no SVG, no dependency. `prefers-reduced-motion` in
 * globals.css freezes it rather than hiding it, which still reads as "busy"
 * alongside `aria-busy`.
 */
function Spinner() {
  return (
    <span
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}
