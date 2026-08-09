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

  /*
    No `images` here, deliberately — `src/app/opengraph-image.tsx` supplies it.

    The precedence runs the opposite way to what that file's comment used to
    claim: an explicit `openGraph.images` **wins over** the file convention, it
    does not lose to it. So while these keys listed `/icons/og-image.jpg`, the
    generated 1200×630 card was built, served at `/opengraph-image`, and then
    referenced by nothing — every share rendered the 512×512 square instead.
    Verified against the served HTML: `og:image` pointed at the .jpg with
    `og:image:width 512`.

    Omitting `images` lets the file convention fill in `og:image`,
    `twitter:image` and the correct 1200×630 dimensions on its own.
  */
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: "/",
    locale: "en_IN",
  },

  twitter: {
    // `summary` is the small square card. The generated card is a 1.91:1
    // banner, which is what `summary_large_image` is for — with `summary` it
    // would be centre-cropped to a square and the wordmark would be cut off.
    card: "summary_large_image",
    title,
    description,
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
