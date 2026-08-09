"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Whether real Firebase credentials were compiled into this bundle.
 *
 * These are `NEXT_PUBLIC_*`, so they are inlined at build time — an empty value
 * here means the build had no Firebase project. The login screen uses this to
 * show an honest disabled state instead of throwing on click.
 */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables.");
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/*
  Three ways in, one contract.

  Each of the functions below does whatever browser dance its provider needs and
  returns a fresh Firebase ID token. Everything downstream — `createSession`, the
  `__session` cookie, `verifySessionCookie`, the middleware gate, the onboarding
  funnel — consumes that token and neither knows nor cares which door it came
  through (docs/feature-email-password-auth.md §1).

  Note what is *not* here: no password ever leaves this module, and none is
  stored. Firebase holds the credential; we hold a token it signed.
*/

/** Opens the Google popup and returns a fresh ID token for the server to exchange. */
export async function signInWithGoogle(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(getFirebaseAuth(), provider);
  return credential.user.getIdToken();
}

/** Email + password sign-in. Throws a `FirebaseError`; map it with `authErrorMessage`. */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return credential.user.getIdToken();
}

/**
 * Create an email + password account and return its ID token.
 *
 * `updateProfile` sets the `displayName`, and `getIdToken(true)` forces a
 * refresh so the new `name` claim is actually in the token we hand the server.
 *
 * **The caller must still pass the name to `createSession` separately.** Claim
 * propagation after `updateProfile` is not contractually immediate, and the
 * failure is silent and permanent: lose the race and the user's name is their
 * email address forever, with no screen in the app to fix it. One redundant
 * argument is a cheap price for that.
 */
export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<string> {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await updateProfile(credential.user, { displayName: name });
  return credential.user.getIdToken(true);
}
