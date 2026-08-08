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
    <main className="flex-1 flex flex-col items-center justify-center px-margin-mobile w-full min-h-screen pt-safe">
      <div className="mb-stack-lg mt-auto flex flex-col items-center">
        <TruckMark />
      </div>

      <div className="text-center mb-12">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Find loads. Book trucks. Instantly.
        </h1>
      </div>

      <div className="w-full flex flex-col gap-stack-md mt-auto mb-stack-lg">
        <GoogleButton />
      </div>

      <div className="pb-safe w-full text-center mb-6">
        <p className="font-label-bold text-label-bold text-secondary">
          By logging in, you agree to our{" "}
          <a className="text-primary underline" href="/terms">
            Terms of Service
          </a>
          .
        </p>
      </div>
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
