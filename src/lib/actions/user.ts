"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
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
  SignUpNameSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/schemas";

/** Prisma's unique-constraint violation — here, always `User.email`. */
const UNIQUE_VIOLATION = "P2002";

/**
 * Exchange a Firebase ID token for an HttpOnly session cookie, upserting the
 * user row on the way (TechnicalDocument.md §4.1).
 *
 * A session cookie rather than the raw ID token: ID tokens last an hour and
 * cannot be revoked, session cookies last days and can (decision D6).
 *
 * **Provider-agnostic.** Google and email/password both arrive here with an ID
 * token and nothing else distinguishes them
 * (docs/feature-email-password-auth.md §1).
 *
 * `displayName` is the sign-up form's answer to a gap in the second case: a
 * bare email/password token frequently carries no `name` claim, and without
 * this the row would be created with the email address as the user's name —
 * silently, permanently, with no screen in the app to correct it. It is
 * re-validated here rather than trusted, and it never wins over a name the
 * token actually carries.
 */
export async function createSession(
  idToken: string,
  displayName?: string,
): Promise<ActionResult<{ next: string }>> {
  if (!idToken) return { ok: false, error: "Missing sign-in token." };

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);

    if (!decoded.email) {
      return { ok: false, error: "That account has no email address." };
    }

    // Token first, the form's answer second, the email address only as a
    // last resort — it is a legible name, which is the whole bar here.
    const parsedName = displayName === undefined ? null : SignUpNameSchema.safeParse(displayName);
    const claimedName = decoded.name?.trim() || null;
    const resolvedName = claimedName ?? (parsedName?.success ? parsedName.data : null);

    const user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {
        email: decoded.email,
        /*
          Conditional, where both of these used to be unconditional writes.

          `name: decoded.name ?? decoded.email` overwrote a good name with an
          email address on every sign-in whose token lacked the claim — which is
          every email/password sign-in. `profileImage: decoded.picture ?? null`
          had the same shape of bug for Google users: a momentarily absent
          picture claim nulled a stored avatar.

          Absent claim means "no news", not "delete what you have".
        */
        ...(resolvedName ? { name: resolvedName } : {}),
        ...(decoded.picture ? { profileImage: decoded.picture } : {}),
      },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email,
        name: resolvedName ?? decoded.email,
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
    /*
      The one database failure worth naming.

      `User.email` is @unique, but the upsert keys on `firebaseUid` — so a
      *second* Firebase UID carrying an email that already has a row takes the
      `create` branch and violates the constraint. That happens when the same
      person signs up with a password and later with Google, or the reverse.

      Firebase's default "one account per email address" setting makes it rare:
      Google is a verified-email provider, so Firebase links it to the existing
      account and reuses the UID. Rare is not never, and the generic message
      below is a dead end for someone who has an account and cannot get in.

      We do not build the linking flow (docs/feature-email-password-auth.md §0),
      so the honest instruction is to use the other door.
    */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      return {
        ok: false,
        error: "An account already exists for this email. Sign in with the method you used before.",
      };
    }

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
