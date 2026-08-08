/**
 * The design tokens as typed TS constants (TechnicalDocument.md §6.1).
 *
 * `src/app/globals.css` is the source of truth — Tailwind reads its `@theme`
 * block and nothing reads this file to build a class name. This exists for the
 * handful of places TypeScript needs a token *value* rather than a utility
 * class: the PWA theme color, canvas/SVG fills, and B2's timer threshold.
 *
 * Values are transcribed from CLAUDE.md §4. If one changes there, it changes in
 * globals.css AND here.
 */

/** CLAUDE.md §4.1 */
export const colors = {
  primary: "#a04100",
  primaryContainer: "#ff6b00",
  onPrimary: "#ffffff",
  onPrimaryContainer: "#572000",
  primaryFixed: "#ffdbcc",
  primaryFixedDim: "#ffb693",
  inversePrimary: "#ffb693",
  onPrimaryFixed: "#351000",
  onPrimaryFixedVariant: "#7a3000",
  surfaceTint: "#a04100",

  secondary: "#565e74",
  secondaryContainer: "#dae2fd",
  secondaryFixed: "#dae2fd",
  secondaryFixedDim: "#bec6e0",
  onSecondary: "#ffffff",

  tertiary: "#006c49",
  tertiaryContainer: "#00ae78",
  onTertiary: "#ffffff",
  onTertiaryContainer: "#003925",

  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  onError: "#ffffff",
  onErrorContainer: "#93000a",

  background: "#f7f9fb",
  surface: "#f7f9fb",
  surfaceBright: "#f7f9fb",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f2f4f6",
  surfaceContainer: "#eceef0",
  surfaceContainerHigh: "#e6e8ea",
  surfaceContainerHighest: "#e0e3e5",
  surfaceVariant: "#e0e3e5",
  surfaceDim: "#d8dadc",

  onBackground: "#191c1e",
  onSurface: "#191c1e",
  onSurfaceVariant: "#5a4136",
  outline: "#8e7164",
  outlineVariant: "#e2bfb0",
  inverseSurface: "#2d3133",
  inverseOnSurface: "#eff1f3",
} as const;

export type ColorToken = keyof typeof colors;

/** CLAUDE.md §4.2 — Inter. Applied in markup as the pair `font-x text-x`. */
export const typography = {
  labelBold: { size: 12, lineHeight: 16, weight: 700 },
  bodyMd: { size: 14, lineHeight: 20, weight: 400 },
  bodyLg: { size: 16, lineHeight: 24, weight: 400 },
  timerMd: { size: 18, lineHeight: 24, weight: 800 },
  headlineMd: { size: 20, lineHeight: 28, weight: 700 },
  headlineLg: { size: 24, lineHeight: 32, weight: 700 },
  displayPrice: { size: 32, lineHeight: 40, weight: 900, letterSpacing: "-0.02em" },
} as const;

/** CLAUDE.md §4.3 — 4px unit. */
export const spacing = {
  unit: 4,
  stackSm: 8,
  gutterMobile: 12,
  stackMd: 16,
  marginMobile: 16,
  stackLg: 24,
  touchTargetMin: 48,
} as const;

export const radius = {
  DEFAULT: "0.25rem",
  lg: "0.5rem",
  xl: "0.75rem",
  full: "9999px",
} as const;

/** Shell geometry (TechnicalDocument.md §7.1), in px. */
export const shell = {
  appBarHeight: 48,
  bottomNavHeight: 64,
  fabSize: 56,
  baselineViewport: { width: 390, height: 844 },
} as const;

/**
 * A countdown goes `text-error` at or below this (TechnicalDocument.md §7.3).
 * B2's Timer is the consumer.
 */
export const TIMER_URGENT_THRESHOLD_MS = 30 * 60 * 1000;

/** Live-bid poll interval (TechnicalDocument.md §7.4). */
export const POLL_INTERVAL_MS = 7000;
