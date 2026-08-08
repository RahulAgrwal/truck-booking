import { redirect } from "next/navigation";

/**
 * Landing route. A1 replaces the unconditional redirect with session-aware
 * routing: no session → /login, role null → /onboarding, otherwise the
 * role's home (TechnicalDocument.md §4.1).
 */
export default function Home() {
  redirect("/login");
}
