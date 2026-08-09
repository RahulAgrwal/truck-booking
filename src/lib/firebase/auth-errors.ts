/**
 * Firebase Auth error codes → copy a driver can act on
 * (docs/feature-email-password-auth.md §3.2).
 *
 * Its own module, not a function inside `clientApp.ts`, for one reason: this is
 * pure and worth unit-testing, and importing `clientApp.ts` pulls the whole
 * Firebase SDK into the test environment to reach it.
 *
 * No `"use client"` — it is plain data and a switch, so it inherits whichever
 * environment imports it.
 */

/** What the user sees when nothing more specific is known. */
export const GENERIC_AUTH_ERROR = "Could not sign you in. Please try again.";

/**
 * Every failed-credential code collapses to one string.
 *
 * This is deliberate and must stay that way: telling "no account with that
 * email" apart from "wrong password" turns the sign-in form into an account
 * enumeration oracle — anyone can check whether a given person uses TruckingGO.
 * Firebase already made this choice for us with `auth/invalid-credential`, its
 * newer deliberately-vague code; special-casing `auth/user-not-found` would
 * undo it.
 */
const INVALID_CREDENTIALS = "Incorrect email or password.";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": INVALID_CREDENTIALS,
  "auth/wrong-password": INVALID_CREDENTIALS,
  "auth/user-not-found": INVALID_CREDENTIALS,
  "auth/invalid-email": INVALID_CREDENTIALS,
  "auth/invalid-login-credentials": INVALID_CREDENTIALS,

  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Choose a longer password — at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "You appear to be offline. Check your connection.",

  // The provider is off in the Firebase console. Every sign-up fails with this
  // until Authentication → Sign-in method → Email/Password is enabled, so it
  // gets a message that names the actual cause instead of blaming the user.
  "auth/operation-not-allowed": "Email sign-in isn't enabled for this app yet.",

  // A password account already owns this email. We do not build the linking
  // flow (feature doc §0), so the honest instruction is to use the other door.
  "auth/account-exists-with-different-credential":
    "An account already exists for this email. Sign in with the method you used before.",
};

/**
 * Codes that mean "the user changed their mind", not "something went wrong".
 * Closing the Google popup is a normal action and must render nothing at all —
 * `google-button.tsx` has always swallowed these two.
 */
const SILENT = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

/**
 * `null` means show nothing. Any other return is safe to put in front of a user.
 *
 * Takes `unknown` because it is fed straight from a `catch`: Firebase throws
 * `FirebaseError`, but a network layer can throw anything, and a mapper that
 * needs the caller to narrow first would just move the problem.
 */
export function authErrorMessage(cause: unknown): string | null {
  const code = errorCode(cause);
  if (!code) return GENERIC_AUTH_ERROR;
  if (SILENT.has(code)) return null;
  return MESSAGES[code] ?? GENERIC_AUTH_ERROR;
}

/** The `code` off a thrown value, when there is one. */
export function errorCode(cause: unknown): string | null {
  if (typeof cause !== "object" || cause === null) return null;
  const code = (cause as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
