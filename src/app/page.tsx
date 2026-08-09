import { redirect } from "next/navigation";

import { getSession, homePathFor } from "@/lib/session";

/**
 * Landing route. Everything here is a redirect: signed out → /login, signed in
 * without a role → /onboarding, otherwise the role's home.
 */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(homePathFor(session.role, session.detailsComplete));
}
