import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

const ADMIN_APP_NAME = "truckinggo-admin";

function readPrivateKey(): string | undefined {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!key) return undefined;
  // Secret Manager stores the PEM with real newlines; a .env file escapes them
  // as "\n". Accept both so the same code works locally and on Cloud Run.
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

/** True when the server has a usable service account. */
export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      readPrivateKey(),
  );
}

/**
 * Lazily initialised so a missing service account is not a startup crash —
 * both build lanes run with DEV_AUTH_BYPASS and no Firebase credentials.
 */
function getAdminApp(): App {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  const privateKey = readPrivateKey();
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }

  return initializeApp(
    {
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    },
    ADMIN_APP_NAME,
  );
}

export function getAdminAuth(): Auth {
  try {
    return getAuth(getApp(ADMIN_APP_NAME));
  } catch {
    return getAuth(getAdminApp());
  }
}
