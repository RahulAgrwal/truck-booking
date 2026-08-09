import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { getSession, homePathFor } from "@/lib/session";

import { AuthDivider } from "../auth-divider";
import { EmailAuthForm } from "../email-auth-form";
import { GoogleButton } from "../login/google-button";

/**
 * Create an account (docs/feature-email-password-auth.md §3.7).
 *
 * Not in Stitch — the design system predates email/password auth — so it is
 * composed from the existing primitives per CLAUDE.md §4.6, and deliberately
 * mirrors `/login` rather than inventing a second visual language for the same
 * job.
 *
 * No logo here, unlike `/login`. The splash sells the product to someone
 * deciding whether to use it; this screen is for someone who has already
 * decided, and it carries a third field, so the space goes to the form.
 */
export default async function SignUpPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.role, session.detailsComplete));

  return (
    <main className="flex min-h-dvh w-full flex-col px-margin-mobile pt-safe">
      {/*
        A real link, not a history-based back button: this page is reachable
        directly (typed, shared, or after the middleware bounce), and `back()`
        on a fresh history stack goes nowhere.
      */}
      <div className="flex h-touch-target-min shrink-0 items-center">
        <Link
          href="/login"
          aria-label="Back to sign in"
          className="-ml-stack-sm flex h-touch-target-min w-touch-target-min items-center justify-center text-on-surface active:opacity-80"
        >
          <Icon name="arrow_back" />
        </Link>
      </div>

      <div className="flex w-full flex-1 flex-col justify-center gap-stack-md py-stack-lg">
        <div className="flex flex-col gap-stack-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Create your account</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            You&apos;ll choose whether you&apos;re shipping or driving next.
          </p>
        </div>

        <EmailAuthForm mode="signup" />

        <AuthDivider />

        <GoogleButton />

        <p className="text-center font-body-md text-body-md text-on-surface-variant">
          Already have an account?{" "}
          <Link className="font-body-lg text-body-lg text-primary underline" href="/login">
            Sign in
          </Link>
        </p>

        <p className="text-center font-label-bold text-label-bold text-secondary">
          By creating an account, you agree to our{" "}
          <a className="text-primary underline" href="/terms">
            Terms of Service
          </a>
          .
        </p>
      </div>

      <div className="pb-safe h-stack-lg shrink-0" aria-hidden="true" />
    </main>
  );
}
