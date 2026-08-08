import { redirect } from "next/navigation";

import { homePathFor, requireSession } from "@/lib/session";

import { RoleCards } from "./role-cards";

/**
 * Stitch screen a3fd9497fe1c40d08b56ba95c58202d7 — "Role Selection".
 *
 * Reachable only once: a user who already has a role is sent to their home.
 */
export default async function OnboardingPage() {
  const session = await requireSession();
  if (session.role !== null) redirect(homePathFor(session.role));

  return (
    <main className="flex-1 flex flex-col px-margin-mobile pt-stack-lg pb-[100px] min-h-screen">
      <header className="mb-stack-lg text-center flex flex-col items-center pt-safe">
        <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center mb-stack-md">
          <span
            className="material-symbols-outlined text-primary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            local_shipping
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-stack-sm">
          Choose your role
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {/*
            The Stitch copy says "You can change this later in settings."
            It cannot: setUserRole rejects a second write, because switching
            roles would orphan a shipper's auctions or a carrier's bids.
            Saying so up front beats a dead end in settings later.
          */}
          This decides which app you see. It can&apos;t be changed later.
        </p>
      </header>

      <RoleCards />
    </main>
  );
}
