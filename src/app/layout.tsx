import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TruckingGO",
  description: "Find loads. Book trucks. Instantly.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "TruckingGO",
    statusBarStyle: "default",
  },
};

// Mobile app, not a responsive site: lock the scale and paint under the notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#a04100",
};

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
