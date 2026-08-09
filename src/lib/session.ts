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
  /**
   * Has onboarding step 2 been completed? Derived from `detailsCompletedAt`,
   * exposed as a boolean because that is the only question anything asks —
   * the timestamp itself is nobody's business outside `updateContactDetails`.
   *
   * Contact details are the point of the whole exchange feature, so a user
   * without them is a user the marketplace cannot complete a job for. That is
   * why this is in the session rather than looked up per screen.
   */
  detailsComplete: boolean;
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

/**
 * DEV_BYPASS_ROLE picks which seeded user the mock session impersonates.
 * "NONE" selects the role-less seed user, which is the only way to reach
 * /onboarding without editing the database.
 */
function bypassEmail(): string {
  switch (process.env.DEV_BYPASS_ROLE) {
    case "CARRIER":
      return "carrier1@demo.test";
    case "NONE":
      return "newcomer@demo.test";
    default:
      return "shipper1@demo.test";
  }
}

async function getBypassSession(): Promise<Session | null> {
  const email = bypassEmail();

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
    detailsComplete: user.detailsCompletedAt !== null,
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
      detailsComplete: user.detailsCompletedAt !== null,
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
 *
 * The details check is what makes onboarding step 2 *required* rather than a
 * suggestion on one screen. It is last, because a user who is on the wrong
 * side of the app should be sent to their own side before being asked for
 * anything.
 *
 * ⚠ **`/onboarding/details` and `/profile/details` must call `requireSession`,
 * never this.** Guarding the details form with the guard that redirects to the
 * details form is an infinite redirect.
 */
export async function requireRole(role: Role): Promise<Session> {
  const session = await requireSession();
  if (session.role === null) redirect("/onboarding");
  if (session.role !== role) redirect(session.role === "SHIPPER" ? "/shipper" : "/carrier");
  if (!session.detailsComplete) redirect("/onboarding/details");
  return session;
}

/**
 * Where a session belongs right now.
 *
 * Role first, then details: a user picks a side before being asked for a truck
 * number, and `setUserRole` hands straight over to step 2.
 *
 * `detailsComplete` defaults to `true` so existing call sites keep compiling,
 * which is a fail-*open* default — forget to pass it and the user reaches a
 * dashboard. That is survivable only because `requireRole` bounces them
 * straight back, so the cost of forgetting is one redundant hop, not an
 * ungated screen. Pass it anyway.
 */
export function homePathFor(role: Role | null, detailsComplete: boolean = true): string {
  if (role === null) return "/onboarding";
  if (!detailsComplete) return "/onboarding/details";
  return role === "SHIPPER" ? "/shipper" : "/carrier";
}
