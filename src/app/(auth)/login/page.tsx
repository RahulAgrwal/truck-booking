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
 * Inline wordmark. The Stitch screen used a hosted PNG; an inline SVG avoids a
 * network round-trip on the first screen users ever see, and it inherits the
 * brand tokens instead of baking them into a raster.
 */
function TruckMark() {
  return (
    <div className="flex flex-col items-center gap-stack-sm">
      <div className="w-32 h-32 rounded-lg bg-primary-container flex items-center justify-center shadow-[0_4px_12px_rgba(0,33,83,0.08)]">
        <span
          className="material-symbols-outlined text-on-primary-container"
          style={{ fontSize: "72px", fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          local_shipping
        </span>
      </div>
      <span className="font-headline-lg text-headline-lg text-primary tracking-tight">
        TruckingGO
      </span>
    </div>
  );
}
