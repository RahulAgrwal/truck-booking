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
import {
  ContactDetailsSchema,
  SetUserRoleSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/schemas";

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

    // The second argument matters here: a returning user who never finished
    // onboarding step 2 must land on the details form, not on a dashboard the
    // guard immediately bounces them off.
    return {
      ok: true,
      data: { next: homePathFor(user.role, user.detailsCompletedAt !== null) },
    };
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
  // A user who has just picked a role has no details, so this hands straight
  // over to onboarding step 2 rather than to a dashboard.
  return {
    ok: true,
    data: { next: homePathFor(user.role, user.detailsCompletedAt !== null) },
  };
}

/**
 * Save the contact details collected at onboarding step 2, and later edited at
 * `/profile/details` (docs/feature-contact-ratings.md §4).
 *
 * These are the columns the whole contact-exchange feature exists to hand over,
 * so the role branch is decided by the **database**, not by the payload: the
 * client picks which shape it is submitting, and the server checks that shape
 * against who the user actually is. A carrier posting a shipper payload is
 * refused rather than quietly writing `companyName` onto a carrier row.
 */
export async function updateContactDetails(input: unknown): Promise<ActionResult<{ next: string }>> {
  const session = await requireSession();

  const parsed = ContactDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  /*
    Read before write, and it earns the round trip twice: `role` is the
    authority the payload is checked against (a session is a snapshot and can
    be minutes old), and `detailsCompletedAt` decides whether this save is the
    first completion or an edit.
  */
  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, detailsCompletedAt: true },
  });

  if (!current) return { ok: false, error: "Your account no longer exists." };
  if (current.role === null) {
    return { ok: false, error: "Choose whether you're shipping or driving first." };
  }

  const details = parsed.data;
  if (details.role !== current.role) {
    return { ok: false, error: "Those details don't match your account type." };
  }

  // Only the fields belonging to this role are written. The other role's
  // columns are left untouched rather than nulled: nothing reads them for this
  // user, and blanking them would destroy data if a role ever became mutable.
  const roleFields =
    details.role === "SHIPPER"
      ? { companyName: details.companyName }
      : { truckNumber: details.truckNumber, truckType: details.truckType };

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      phone: details.phone,
      address: details.address,
      ...roleFields,
      // Stamp the *first* completion only. An edit must not move it, or the
      // column stops meaning what its name says.
      ...(current.detailsCompletedAt === null ? { detailsCompletedAt: new Date() } : {}),
    },
  });

  // The session carries detailsComplete, so the whole tree's guards change.
  revalidatePath("/", "layout");

  // Details are complete as of this write, whatever they were a moment ago.
  return { ok: true, data: { next: homePathFor(current.role, true) } };
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
