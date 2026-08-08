"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getAdminAuth } from "@/lib/firebase/adminApp";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  getSession,
  homePathFor,
  requireSession,
} from "@/lib/session";
import { SetUserRoleSchema, firstIssue, type ActionResult } from "@/lib/schemas";

/**
 * Exchange a Firebase ID token for an HttpOnly session cookie, upserting the
 * user row on the way (TechnicalDocument.md §4.1).
 *
 * A session cookie rather than the raw ID token: ID tokens last an hour and
 * cannot be revoked, session cookies last days and can (decision D6).
 */
export async function createSession(idToken: string): Promise<ActionResult<{ next: string }>> {
  if (!idToken) return { ok: false, error: "Missing sign-in token." };

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);

    if (!decoded.email) {
      return { ok: false, error: "Your Google account has no email address." };
    }

    const user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {
        email: decoded.email,
        name: decoded.name ?? decoded.email,
        profileImage: decoded.picture ?? null,
      },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email,
        name: decoded.name ?? decoded.email,
        profileImage: decoded.picture ?? null,
        // role stays null — /onboarding sets it.
      },
    });

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    (await cookies()).set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    return { ok: true, data: { next: homePathFor(user.role) } };
  } catch (error) {
    console.error("[createSession]", error);
    return { ok: false, error: "Could not sign you in. Please try again." };
  }
}

/**
 * Choose SHIPPER or CARRIER. Set once — changing roles would orphan a
 * shipper's auctions or a carrier's bids, so the guard is deliberate.
 */
export async function setUserRole(input: unknown): Promise<ActionResult<{ next: string }>> {
  const session = await requireSession();

  const parsed = SetUserRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  if (session.role !== null) {
    return { ok: false, error: "Your role is already set." };
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { role: parsed.data.role },
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { next: homePathFor(user.role) } };
}

/** Clear the cookie and revoke refresh tokens, so the session dies everywhere. */
export async function signOut(): Promise<void> {
  const session = await getSession();

  if (session) {
    try {
      await getAdminAuth().revokeRefreshTokens(session.firebaseUid);
    } catch (error) {
      // Best effort: clearing the cookie below still ends this session.
      console.error("[signOut] revokeRefreshTokens", error);
    }
  }

  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
