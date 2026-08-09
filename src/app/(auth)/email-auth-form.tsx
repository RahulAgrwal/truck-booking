"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSession } from "@/lib/actions/user";
import { authErrorMessage, errorCode } from "@/lib/firebase/auth-errors";
import { isFirebaseConfigured, signInWithEmail, signUpWithEmail } from "@/lib/firebase/clientApp";
import { EmailSignInSchema, EmailSignUpSchema, firstIssue } from "@/lib/schemas";

import { PasswordField } from "./password-field";

/**
 * Email + password sign-in and sign-up
 * (docs/feature-email-password-auth.md §3.7).
 *
 * One component for both modes, on the same reasoning as `DetailsForm`: the
 * fields, the error handling and the destination are identical, and only the
 * copy plus one extra field differ. Two copies would drift.
 *
 * The flow is deliberately identical to `google-button.tsx` — get an ID token
 * somehow, hand it to `createSession`, go where the server says. The provider
 * is the only thing that varies, and nothing downstream of the token knows
 * which one was used.
 */

export type EmailAuthMode = "signin" | "signup";

type Values = { name: string; email: string; password: string };

const EMPTY: Values = { name: "", email: "", password: "" };

const COPY = {
  signin: { submit: "Sign in", busy: "Signing in…" },
  signup: { submit: "Create account", busy: "Creating your account…" },
} as const;

export function EmailAuthForm({ mode }: { mode: EmailAuthMode }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(EMPTY);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, startTransition] = useTransition();

  const isSignUp = mode === "signup";
  // Both flags, same as the Google button: `submitting` covers the Firebase
  // round trip, `pending` the Server Action. A button live during either
  // creates a second account or a second session.
  const busy = submitting || pending;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear the message the moment the offending field is touched.
    setFieldError((current) => (current?.field === key ? null : current));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);

    /*
      Client-side parse first, so an eight-character rule costs no network call
      and the message lands under the field it belongs to.

      This is UX and nothing else — Firebase verifies the credential and the
      server re-verifies the token it returns (src/lib/schemas.ts).
    */
    const parsed = isSignUp
      ? EmailSignUpSchema.safeParse(values)
      : EmailSignInSchema.safeParse(values);

    if (!parsed.success) {
      const { error, field } = firstIssue(parsed.error);
      setFieldError({ field, message: error });
      return;
    }

    setSubmitting(true);

    try {
      /*
        The annotation, not a cast, is what merges the two parse results: both
        schemas produce `email` and `password`, and only the sign-up one
        produces `name`, so both outputs are assignable to this shape. It also
        makes `name` the single thing that selects the provider below — one
        narrowing instead of an `isSignUp` branch TypeScript cannot connect back
        to the parse result.
      */
      const data: { email: string; password: string; name?: string } = parsed.data;
      const { email, password, name } = data;

      const idToken =
        name === undefined
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(name, email, password);

      startTransition(async () => {
        // `name` travels separately as well: the token's claim may not have
        // caught up with `updateProfile` yet (clientApp.ts).
        const result = await createSession(idToken, name);
        if (result.ok) {
          router.replace(result.data.next);
          router.refresh();
        } else {
          setFieldError({ field: result.field, message: result.error });
        }
      });
    } catch (cause) {
      const message = authErrorMessage(cause);
      if (message) {
        console.error("[EmailAuthForm]", cause);
        // Firebase reports "email already in use" and "weak password" against a
        // specific field; everything else is a form-level failure.
        setFieldError({ field: fieldForCode(cause), message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const errorFor = (field: keyof Values) =>
    fieldError?.field === field ? fieldError.message : undefined;
  const formError = fieldError && !fieldError.field ? fieldError.message : null;

  if (!isFirebaseConfigured) {
    return (
      <p className="text-center font-body-md text-body-md text-on-surface-variant">
        No Firebase project is configured for this build, so accounts are unavailable.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-stack-md" noValidate>
      {isSignUp ? (
        <Input
          label="Full name"
          name="name"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          error={errorFor("name")}
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={80}
          placeholder="Rahul Agarwal"
          required
        />
      ) : null}

      <Input
        label="Email"
        name="email"
        value={values.email}
        onChange={(event) => set("email", event.target.value)}
        error={errorFor("email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        placeholder="you@company.in"
        required
      />

      <PasswordField
        label="Password"
        name="password"
        value={values.password}
        onChange={(event) => set("password", event.target.value)}
        error={errorFor("password")}
        // `new-password` is what tells a password manager to offer to generate
        // and save one; `current-password` is what makes it autofill.
        autoComplete={isSignUp ? "new-password" : "current-password"}
        hint={isSignUp ? "At least 8 characters." : undefined}
        enterKeyHint="go"
        required
      />

      {formError ? (
        <p role="alert" className="font-label-bold text-label-bold text-error">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={busy}>
        {busy ? COPY[mode].busy : COPY[mode].submit}
      </Button>
    </form>
  );
}

/**
 * Which field a Firebase failure belongs under, when it belongs under one.
 *
 * Note what is absent: the wrong-credential codes. Pinning "Incorrect email or
 * password" to the email field would tell an attacker which half was wrong —
 * the same enumeration leak `authErrorMessage` exists to avoid.
 */
function fieldForCode(cause: unknown): string | undefined {
  switch (errorCode(cause)) {
    case "auth/email-already-in-use":
      return "email";
    case "auth/weak-password":
      return "password";
    default:
      return undefined;
  }
}
