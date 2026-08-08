"use client";

import { useEffect } from "react";

/**
 * The last resort: an error thrown by the **root layout itself**.
 *
 * `error.tsx` renders inside the layout, so it cannot catch a layout that
 * failed. This one replaces the whole document — which is why it has to supply
 * its own `<html>` and `<body>`, and why it cannot import `AppShell` or
 * anything that depends on the layout having worked.
 *
 * It deliberately uses **inline styles and no token classes**. If the failure
 * was `globals.css` not loading, every `bg-surface` here would render as
 * nothing and the user would get invisible text on a white page. This is the
 * one screen in the app where hard-coded values are the correct choice, and it
 * is the only reason a hex appears outside `globals.css` and `tokens.ts`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#f7f9fb",
          color: "#191c1e",
        }}
      >
        <h1 style={{ fontSize: 24, lineHeight: "32px", fontWeight: 700, margin: 0 }}>
          TruckingGO couldn&apos;t start
        </h1>
        <p style={{ fontSize: 16, lineHeight: "24px", margin: 0, color: "#5a4136" }}>
          Something failed before the app could load. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 48,
            padding: "0 24px",
            border: "none",
            borderRadius: 8,
            background: "#ff6b00",
            color: "#572000",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
