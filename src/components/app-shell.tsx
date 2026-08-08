import type { ReactNode } from "react";

/**
 * The viewport-locked mobile shell (TechnicalDocument.md §7.1).
 *
 * ```
 * ┌────────────────────────── safe-area-top ──┐
 * │ TopAppBar   fixed  h-48  z-50              │
 * ├────────────────────────────────────────────┤
 * │ AppScreen   the only scrolling region      │
 * │             pt-[48+24] pb-[64+24] px-16    │
 * ├────────────────────────────────────────────┤
 * │ MobileNav   fixed  h-64  z-50  pb-safe     │  ← B2
 * └─────────────────────── safe-area-bottom ───┘
 * ```
 *
 * Split into three exports rather than one component with header/nav slots,
 * because `AppShell` is mounted in the ROOT layout and therefore also wraps
 * `/login` and `/onboarding` — full-bleed auth screens that render their own
 * `<main>` and must not grow a top bar or a bottom nav. Dashboard screens
 * compose the pieces themselves:
 *
 * ```tsx
 * <>
 *   <TopAppBar leading={<Avatar …/>} title="TruckingGO" trailing={<Bell />} />
 *   <AppScreen>…</AppScreen>
 *   <MobileNav role="SHIPPER" active="home" />
 * </>
 * ```
 *
 * Composition lives at the page level because neither lane owns a
 * `(dashboard)/layout.tsx` (BuildPlan.md §3).
 *
 * All three are Server Components — nothing here needs client state.
 */

/**
 * Root wrapper. Establishes the fixed-height viewport that `<main>` scrolls
 * inside of; the no-bounce / no-horizontal-scroll rules themselves live on
 * html/body in globals.css.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-background">
      {children}
    </div>
  );
}

/**
 * Fixed top app bar, 48px tall below the notch. The safe-area inset pads the
 * bar's *outer* box, so the bar itself stays a full 48px touch target on a
 * notched device instead of being squeezed by it.
 */
export function TopAppBar({
  leading,
  title,
  trailing,
}: {
  leading?: ReactNode;
  title?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <header className="pt-safe fixed top-0 left-0 z-50 w-full border-b border-outline-variant bg-surface">
      <div className="flex h-touch-target-min items-center justify-between gap-stack-sm px-margin-mobile">
        <div className="flex min-w-0 flex-1 items-center gap-stack-sm">
          {leading}
          {typeof title === "string" ? (
            <span className="truncate font-headline-md text-headline-md text-on-surface">{title}</span>
          ) : (
            title
          )}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-stack-sm">{trailing}</div> : null}
      </div>
    </header>
  );
}

/**
 * The scrolling region. Its padding clears the two fixed bars *and* the device
 * insets — `pt-safe` on the app bar pushes the bar down, so the offset here has
 * to include the same inset or the first card slides under it.
 *
 * @param hasAppBar  false on screens with no TopAppBar (auth flows)
 * @param hasNav     false on screens with no MobileNav (create/detail flows
 *                   that end in a sticky footer button instead)
 */
export function AppScreen({
  children,
  className = "",
  hasAppBar = true,
  hasNav = true,
}: {
  children: ReactNode;
  className?: string;
  hasAppBar?: boolean;
  hasNav?: boolean;
}) {
  const top = hasAppBar
    ? "pt-[calc(env(safe-area-inset-top,0px)+48px+24px)]"
    : "pt-[calc(env(safe-area-inset-top,0px)+24px)]";
  const bottom = hasNav
    ? "pb-[calc(env(safe-area-inset-bottom,0px)+64px+24px)]"
    : "pb-[calc(env(safe-area-inset-bottom,0px)+24px)]";

  return (
    <main className={`flex-1 space-y-stack-md px-margin-mobile ${top} ${bottom} ${className}`}>
      {children}
    </main>
  );
}
