import { Inter } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

/**
 * Document metadata and viewport come from Lane B's design module
 * (docs/progress-B.md, HANDOFF TO A #2). Defining them there keeps themeColor
 * and the icon set next to the tokens they derive from, while this file — which
 * Lane A owns — just re-exports them.
 *
 * It also adds `formatDetection.telephone: false`, which matters on device:
 * without it iOS Safari auto-links anything number-shaped, turning ₹ amounts,
 * kg weights and countdown digits into blue tappable links.
 */
export { siteMetadata as metadata, siteViewport as viewport } from "@/lib/design/metadata";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Material Symbols is a webfont, not a React icon package (CLAUDE.md §4.5). */}
      <head>
        {/* no-page-custom-font targets the Pages Router; in the App Router a <link>
            in the root layout is applied once, globally. Safe to disable. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
