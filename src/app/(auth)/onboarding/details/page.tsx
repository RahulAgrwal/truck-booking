import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";

import { DetailsForm } from "./details-form";

/**
 * Onboarding step 2 — contact details.
 *
 * Hand-built; there is no Stitch screen for it. Shape from Mobbin's
 * personal-details forms (Zip, DoorDash Dasher): a flat stack of labelled
 * inputs under a one-line explanation of why they are being asked, and one
 * sticky save.
 *
 * **`requireSession`, never `requireRole`.** `requireRole` redirects a user
 * with no details *to this page*, so calling it here would redirect the page to
 * itself forever. This is the one seam where the Lane B guard and the Lane A
 * page have to agree (docs/feature-contact-ratings.md §4).
 */
export const dynamic = "force-dynamic";

export default async function OnboardingDetailsPage() {
  const session = await requireSession();

  // Step 2 of 2: without a role there is nothing to ask for yet, and the two
  // roles need different fields.
  if (session.role === null) redirect("/onboarding");

  /*
    There is deliberately no "already filled in? go home" check here.

    Deciding where a session belongs is `homePathFor` / `requireRole`'s job, and
    that lands with Lane B's `B5`: once `detailsComplete` is on the session,
    `setUserRole` routes a fresh user *to* this page and `requireRole` routes a
    finished one *away* from it, from one definition. A second copy of that rule
    living in this page is exactly the two-sources-of-truth the board warns
    about — and the first version of this file proved it, by reimplementing the
    check as a `detailsCompletedAt` query that then failed at runtime.

    Until B5 lands, reaching this page with details already set shows an
    unprefilled form. Nothing links here once onboarding is done, so it takes a
    hand-typed URL, and submitting is an edit rather than data loss.
  */

  return (
    <main className="flex min-h-screen flex-1 flex-col px-margin-mobile pt-stack-lg pb-[100px]">
      <header className="mb-stack-lg flex flex-col pt-safe">
        <span className="mb-stack-sm font-label-bold text-label-bold uppercase tracking-wider text-primary">
          Step 2 of 2
        </span>
        <h1 className="mb-stack-sm font-headline-lg text-headline-lg text-on-surface">
          {session.role === "SHIPPER" ? "Your shipping details" : "Your truck details"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {/*
            Say why, once, plainly. "We value your privacy" is noise; the
            actual rule — nobody sees this until a deal is struck — is the
            thing that makes someone willing to type a phone number in.
          */}
          Nobody can see these until you and a{" "}
          {session.role === "SHIPPER" ? "carrier" : "shipper"} have agreed on a load. Then you both
          get each other&apos;s, so the pickup can actually happen.
        </p>
      </header>

      <DetailsForm role={session.role} mode="onboarding" />
    </main>
  );
}
