import Image from "next/image";
import { redirect } from "next/navigation";

import { getSession, homePathFor } from "@/lib/session";

import { GoogleButton } from "./google-button";

/**
 * Stitch screen 23b5db873d684cb1af8e716879c4ab9f — "Splash & Login".
 *
 * The Stitch markup referenced two tokens that are not in the design system
 * (`text-navy-blue`, `btn-active`); those are replaced with their token
 * equivalents, `text-on-surface` and an `active:` press state.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.role));

  return (
    <main className="flex min-h-dvh w-full flex-col items-center px-margin-mobile pt-safe">
      {/*
        One centred group — mark, tagline, button and terms travel together.

        The previous version had `mt-auto` on both the mark and the button,
        which pushed them to opposite ends of the viewport and stranded the
        button at the very bottom, far from the text it belongs to. A single
        `flex-1 justify-center` block keeps the whole call-to-action as one
        readable unit, which also stops it drifting on taller phones.
      */}
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-stack-lg">
        <TruckMark />

        <h1 className="text-center font-headline-lg text-headline-lg text-on-surface">
          Find loads. Book trucks. Instantly.
        </h1>

        <div className="flex w-full flex-col gap-stack-md">
          <GoogleButton />

          <p className="text-center font-label-bold text-label-bold text-secondary">
            By logging in, you agree to our{" "}
            <a className="text-primary underline" href="/terms">
              Terms of Service
            </a>
            .
          </p>
        </div>
      </div>

      {/* Breathing room above the home indicator, without pinning content to it. */}
      <div className="pb-safe h-stack-lg shrink-0" aria-hidden="true" />
    </main>
  );
}

/**
 * The product logo — the truck-and-road lockup from the Stitch project's
 * "TruckingGO Logo" screen, which the Splash & Login screen renders as its one
 * piece of branding.
 *
 * This replaces a hand-built stand-in (a Material Symbols truck in an orange
 * tile, plus the wordmark as text). The stand-in was chosen to avoid a network
 * round-trip to Stitch's CDN and to inherit the brand tokens; serving the real
 * mark from `public/` keeps the first point — it is same-origin, 6KB, and
 * `priority` puts it in the initial payload — and gives up the second, which
 * the mark cannot honour anyway: its navy is part of the artwork, not a token.
 * Same exemption the Google "G" already has (progress-A.md, V6).
 *
 * No text wordmark beneath it: the lockup contains one, and Stitch shows the
 * image alone. The alt text carries the name for screen readers.
 *
 * The asset is the Stitch original with its baked `#f3f7fa` background keyed to
 * alpha and the margin trimmed — as a flat JPEG it sat a shade darker than our
 * `surface` `#f7f9fb` and read as a faint box.
 */
function TruckMark() {
  return (
    <Image
      src="/logo.png"
      alt="TruckingGO"
      width={415}
      height={112}
      priority
      className="h-auto w-64 max-w-full"
    />
  );
}
