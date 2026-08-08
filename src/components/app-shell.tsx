import type { ReactNode } from "react";

/**
 * A0 STUB — Lane B replaces this in step B0.
 *
 * B0 implements the real viewport-locked mobile shell: fixed top app bar,
 * a single scrolling <main>, fixed bottom nav, and safe-area padding
 * (TechnicalDocument.md §7.1). Until then this passes children through so
 * the project compiles.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
