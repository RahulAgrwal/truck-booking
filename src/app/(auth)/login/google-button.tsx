"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createSession } from "@/lib/actions/user";
import { isFirebaseConfigured, signInWithGoogle } from "@/lib/firebase/clientApp";

/**
 * The only client component on the login screen: Firebase's popup needs the
 * browser. The ID token it returns is handed straight to a Server Action, which
 * exchanges it for an HttpOnly cookie — the token never lands in localStorage.
 */
export function GoogleButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [signingIn, setSigningIn] = useState(false);

  const busy = pending || signingIn;

  async function handleClick() {
    setError(null);
    setSigningIn(true);

    try {
      const idToken = await signInWithGoogle();

      startTransition(async () => {
        const result = await createSession(idToken);
        if (result.ok) {
          router.replace(result.data.next);
        } else {
          setError(result.error);
        }
      });
    } catch (cause) {
      // Closing the popup is a normal user action, not an error worth shouting about.
      const code = (cause as { code?: string } | null)?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        console.error("[GoogleButton]", cause);
        setError("Could not sign you in. Please try again.");
      }
    } finally {
      setSigningIn(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="w-full">
        <button
          disabled
          className="w-full h-[56px] bg-surface-container-low border border-outline-variant rounded flex items-center justify-center gap-3 opacity-60"
        >
          <span className="font-headline-md text-headline-md text-on-surface-variant">
            Google sign-in unavailable
          </span>
        </button>
        <p className="mt-stack-sm text-center font-label-bold text-label-bold text-on-surface-variant">
          No Firebase project is configured for this build.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
        className="w-full h-[56px] bg-surface-container-lowest border border-outline-variant rounded flex items-center justify-center gap-3 shadow-[0_2px_4px_rgba(15,23,42,0.08)] active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {busy ? (
          <span className="font-headline-md text-headline-md text-on-surface">Signing in…</span>
        ) : (
          <>
            <GoogleMark />
            <span className="font-headline-md text-headline-md text-on-surface">
              Continue with Google
            </span>
          </>
        )}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-stack-sm text-center font-label-bold text-label-bold text-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
