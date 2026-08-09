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

const FALLBACK_SITE_URL = "http://localhost:3000";

/**
 * Absolute base for OG/Twitter image URLs — relative paths are not valid in
 * social cards. Optional: unset it and OG images simply resolve against
 * localhost, which is correct for development and harmless in a build.
 *
 * **`||`, not `??`, and then a try/catch — both deliberate.** This used to read
 * `process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK`, which looks equivalent and is
 * not: `??` falls back only on null/undefined, so `NEXT_PUBLIC_SITE_URL=""` in
 * `.env.local` produced `new URL("")`, which throws.
 *
 * That throw happens at **module scope in the root layout's import graph**, so
 * it did not break the OG card — it 500'd *every route in the app*, including
 * `/login`. An unset variable and a variable set to empty are the same
 * intention, and neither is worth a total outage, so the parse is guarded too:
 * a typo'd origin now degrades to localhost with a warning instead.
 */
function resolveSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL;

  try {
    return new URL(configured);
  } catch {
    console.warn(
      `[metadata] NEXT_PUBLIC_SITE_URL is not a valid absolute URL; falling back to ${FALLBACK_SITE_URL}.`,
    );
    return new URL(FALLBACK_SITE_URL);
  }
}

const siteUrl = resolveSiteUrl();

/**
 * The social card's absolute URL: `NEXT_PUBLIC_SITE_URL` + the route that
 * `src/app/opengraph-image.tsx` is served from.
 *
 * Built from `siteUrl.origin` rather than the raw environment variable. Same
 * value when the variable is set properly, but `.origin` normalises away a
 * trailing slash — so `https://x.example.com/` cannot produce
 * `https://x.example.com//opengraph-image` — and an unset or malformed
 * variable still degrades to the localhost fallback instead of emitting a
 * bare relative path, which is not a valid `og:image` at all.
 */
const OG_IMAGE_URL = `${siteUrl.origin}/opengraph-image`;

/**
 * Must match the `alt` and `size` exports of `src/app/opengraph-image.tsx`.
 *
 * Duplicated rather than imported: that module lives under `src/app/` (the
 * other lane's tree) and, more importantly, it reads the icon off disk at
 * module scope and pulls in `next/og` — importing it here would run both every
 * time anything touched the metadata.
 */
const OG_ALT =
  "TruckingGO — shippers post loads as timed reverse auctions, verified carriers bid the price down";
const OG_SIZE = { width: 1200, height: 630 };

const title = "TruckingGO";
const description =
  "Find loads. Book trucks. Instantly. Shippers post loads as timed reverse auctions; verified carriers bid the price down.";

export const siteMetadata: Metadata = {
  metadataBase: siteUrl,
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
    `images` points explicitly at `NEXT_PUBLIC_SITE_URL` + `/opengraph-image`,
    the route `src/app/opengraph-image.tsx` serves.

    Leaving it out would also work — the file convention fills in `og:image`
    on its own, resolved against `metadataBase`, which is the same origin. It
    is explicit anyway so the dependency on `NEXT_PUBLIC_SITE_URL` is visible
    and greppable at the point it matters, rather than an emergent property of
    how Next resolves a relative path.

    ⚠ **An explicit `images` overrides the file convention's metadata, so the
    dimensions and alt below are now load-bearing.** This exact key once listed
    `/icons/og-image.jpg` and shipped `og:image:width 512` against a 1200×630
    card — the generated image was built, served, and referenced by nothing.
    Change the URL here and you must change `OG_SIZE`/`OG_ALT` with it.

    One deliberate loss: the file convention appends a content hash
    (`?d2482b9559ea1c70`) that busts scraper caches when the card is redrawn.
    A static URL does not, so a redesigned card may show stale in platforms
    that cache aggressively until they re-scrape.
  */
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: "/",
    locale: "en_IN",
    images: [
      {
        url: OG_IMAGE_URL,
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        alt: OG_ALT,
        type: "image/png",
      },
    ],
  },

  twitter: {
    // `summary` is the small square card. The generated card is a 1.91:1
    // banner, which is what `summary_large_image` is for — with `summary` it
    // would be centre-cropped to a square and the wordmark would be cut off.
    card: "summary_large_image",
    title,
    description,
    images: [{ url: OG_IMAGE_URL, alt: OG_ALT }],
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
