import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { colors } from "@/lib/design/tokens";

/**
 * The social card — Next's `opengraph-image` file convention, so it is
 * generated at build time and wired into `og:image` and `twitter:image`
 * automatically.
 *
 * ⚠ **It does NOT take precedence over `src/lib/design/metadata.ts`** — the
 * opposite is true. An explicit `openGraph.images` in the metadata export wins,
 * and the file convention only fills in when that key is absent. This comment
 * claimed otherwise, and while it did, `metadata.ts` listed
 * `/icons/og-image.jpg` (512×512) with `twitter:card: "summary"` — so this card
 * was generated, served at `/opengraph-image`, and referenced by nothing.
 * If you add `images` back to `metadata.ts`, this file goes dark again.
 *
 * Rendered with `next/og`, which ships inside Next and needs no new dependency.
 * It supplies its own font, so nothing is fetched at build time either — worth
 * keeping that way, since a build-time font download is a network dependency in
 * Cloud Build for a decorative asset.
 *
 * **Satori, not a browser.** Flexbox only — no grid, no floats — every element
 * with more than one child needs an explicit `display: flex`, and only the one
 * bundled weight is available. Hierarchy here therefore comes from size and
 * colour rather than from bold text.
 */
export const alt =
  "TruckingGO — shippers post loads as timed reverse auctions, verified carriers bid the price down";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The app icon, inlined. Reused rather than redrawn so the card and the
 * installed app cannot drift apart — and read at build time, so the running
 * container never touches the filesystem for this.
 */
const markDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "icons", "icon-512.png"),
).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // Dark canvas: social feeds are busy and mostly white, so a dark card
          // separates from the surrounding page and lets the safety orange carry.
          backgroundColor: colors.onSurface,
          padding: 72,
          fontFamily: "Geist, sans-serif",
        }}
      >
        {/* Brand lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders this, not the browser; next/image does not exist here. */}
          <img src={markDataUri} alt="" width={112} height={112} style={{ borderRadius: 24 }} />
          <div style={{ display: "flex", fontSize: 64, letterSpacing: -1.5 }}>
            <span style={{ color: colors.surfaceContainerLowest }}>Trucking</span>
            <span style={{ color: colors.primaryContainer }}>GO</span>
          </div>
        </div>

        {/* What it is */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, color: colors.surfaceContainerLowest, letterSpacing: -2 }}>
            Find loads. Book trucks. Instantly.
          </div>
          <div style={{ display: "flex", fontSize: 32, color: colors.surfaceVariant, lineHeight: 1.4 }}>
            Shippers post loads as time-boxed reverse auctions. Verified carriers bid the price down.
          </div>
        </div>

        {/* Three-word summary of the mechanism, and the accent rule. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {["Post a load", "Watch bids fall", "Accept the best"].map((step, i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {i > 0 ? (
                  <span style={{ fontSize: 28, color: colors.primaryContainer }}>→</span>
                ) : null}
                <span style={{ fontSize: 28, color: colors.surfaceContainerLowest }}>{step}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              width: 200,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.primaryContainer,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
