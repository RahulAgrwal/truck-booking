import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession, homePathFor } from "@/lib/session";

import { AuthDivider } from "../auth-divider";
import { EmailAuthForm } from "../email-auth-form";
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
  if (session) redirect(homePathFor(session.role, session.detailsComplete));

  return (
    <main className="flex min-h-dvh w-full flex-col items-center px-margin-mobile pt-safe">
      {/*
        One centred group — mark, tagline, form and terms travel together.

        `justify-center` with `flex-1`, not `mt-auto` on the pieces: an earlier
        version pushed the mark and the button to opposite ends of the viewport
        and stranded the button far from the text it belongs to.

        The screen now carries a two-field form as well as the Google button, so
        the gap dropped from `stack-lg` to `stack-md` and the mark shrank from
        `w-64` to `w-48`. At 390×844 the whole column is ~640px, which clears
        the fold; on a 360×640 phone it does not, and `justify-center` on a
        `min-h-dvh` column lets it scroll rather than clip.
      */}
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-stack-md py-stack-lg">
        <TruckMark />

        <h1 className="text-center font-headline-lg text-headline-lg text-on-surface">
          Find loads. Book trucks. Instantly.
        </h1>

        <div className="flex w-full flex-col gap-stack-md">
          <EmailAuthForm mode="signin" />

          <AuthDivider />

          <GoogleButton />

          <p className="text-center font-body-md text-body-md text-on-surface-variant">
            New to TruckingGO?{" "}
            <Link className="font-body-lg text-body-lg text-primary underline" href="/signup">
              Create an account
            </Link>
          </p>

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
      className="h-auto w-48 max-w-full"
    />
  );
}
