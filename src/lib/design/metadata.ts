import type { Metadata, Viewport } from "next";

import { colors } from "./tokens";

/**
 * The app's document metadata and viewport, in one Lane-B-owned module.
 *
 * These belong on `src/app/layout.tsx`, which Lane A owns (BuildPlan.md §3), so
 * they are defined here and re-exported there rather than edited in place:
 *
 * ```ts
 * export { siteMetadata as metadata, siteViewport as viewport } from "@/lib/design/metadata";
 * ```
 *
 * Assets referenced below all ship in `public/icons/` (B0).
 */

/**
 * Absolute base for OG/Twitter image URLs — relative paths are not valid in
 * social cards. Optional: unset it and OG images simply resolve against
 * localhost, which is correct for development and harmless in a build.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "TruckingGO";
const description =
  "Find loads. Book trucks. Instantly. Shippers post loads as timed reverse auctions; verified carriers bid the price down.";

export const siteMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: title,
  title: {
    // Screens set their own title; this frames it. `default` covers the root.
    default: title,
    template: `%s · ${title}`,
  },
  description,
  manifest: "/manifest.json",

  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/icons/icon-512.png", color: colors.primary }],
  },

  appleWebApp: {
    capable: true,
    title,
    statusBarStyle: "default",
  },

  /*
    Off on all three. iOS Safari otherwise auto-links anything that looks like a
    phone number — which, on a screen full of ₹ amounts, weights in kg and
    countdown digits, turns arbitrary numbers into blue tappable links.
  */
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },

  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: "/",
    locale: "en_IN",
    images: [
      {
        url: "/icons/og-image.jpg",
        width: 512,
        height: 512,
        alt: "TruckingGO",
      },
    ],
  },

  twitter: {
    card: "summary",
    title,
    description,
    images: ["/icons/og-image.jpg"],
  },

  // Only /login is reachable without a session; everything else redirects.
  robots: {
    index: true,
    follow: true,
  },
};

export const siteViewport: Viewport = {
  // Mobile app, not a responsive site: lock the scale and paint under the notch.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: colors.primary,
  colorScheme: "light",
};
