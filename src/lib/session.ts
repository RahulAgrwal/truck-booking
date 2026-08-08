import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAdminAuth, isFirebaseAdminConfigured } from "@/lib/firebase/adminApp";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "__session";
/** Firebase caps session cookies at 14 days; 5 is a reasonable middle ground. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type Session = {
  userId: string;
  firebaseUid: string;
  email: string;
  name: string;
  profileImage: string | null;
  role: Role | null;
};

/**
 * DEV_AUTH_BYPASS mocks a signed-in session so the app runs with no Firebase
 * credentials (TechnicalDocument.md §4.4).
 *
 * This is the security boundary, and it is deliberately a RUNTIME check:
 * NODE_ENV === "production" disables the bypass unconditionally, whatever the
 * environment says. next.config.ts only warns, because `next build` sets
 * NODE_ENV=production even for the local production build every step requires.
 */
function bypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
}

async function getBypassSession(): Promise<Session | null> {
  const role = process.env.DEV_BYPASS_ROLE === "CARRIER" ? "CARRIER" : "SHIPPER";
  const email = role === "CARRIER" ? "carrier1@demo.test" : "shipper1@demo.test";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.warn(`[DEV_AUTH_BYPASS] No seeded user ${email}. Run \`npm run db:seed\`.`);
    return null;
  }

  return {
    userId: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    name: user.name,
    profileImage: user.profileImage,
    role: user.role,
  };
}

/**
 * The current session, or null. Never throws — a bad or expired cookie is
 * simply "not signed in".
 */
export async function getSession(): Promise<Session | null> {
  if (bypassEnabled()) return getBypassSession();

  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie || !isFirebaseAdminConfigured()) return null;

  try {
    // checkRevoked: a signed-out or disabled user must lose access immediately,
    // not whenever the 5-day cookie happens to expire.
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    const user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    if (!user) return null;

    return {
      userId: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      name: user.name,
      profileImage: user.profileImage,
      role: user.role,
    };
  } catch {
    return null;
  }
}

/** Session or redirect to /login. Use at the top of any protected page or action. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Session with a specific role, or redirect. Role separation lives here rather
 * than in middleware, which cannot run the Admin SDK on the Edge runtime.
 */
export async function requireRole(role: Role): Promise<Session> {
  const session = await requireSession();
  if (session.role === null) redirect("/onboarding");
  if (session.role !== role) redirect(session.role === "SHIPPER" ? "/shipper" : "/carrier");
  return session;
}

/** Where a session belongs right now. */
export function homePathFor(role: Role | null): string {
  if (role === "SHIPPER") return "/shipper";
  if (role === "CARRIER") return "/carrier";
  return "/onboarding";
}
