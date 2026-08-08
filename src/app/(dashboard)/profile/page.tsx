import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

import { SignOutButton } from "./sign-out-button";

/**
 * Profile — hand-built; no Stitch screen (CLAUDE.md §4.6).
 *
 * Shared by both roles, which is why it uses `requireSession` and not
 * `requireRole`: it is the one screen in `(dashboard)` either role can reach,
 * and `MobileNav` needs the role only to know which three tabs to draw.
 *
 * Deliberately thin. There are no settings to change — the role is immutable
 * once chosen (`setUserRole` refuses a second write), so a "change role"
 * control would be a dead end, and inventing preferences nothing reads would be
 * worse than a short screen.
 */
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession();

  // A role-less user has not finished onboarding; there is no profile to show.
  if (session.role === null) redirect("/onboarding");

  // Cheap, and it makes the screen say something the session cookie does not.
  const [auctionCount, bidCount] = await Promise.all([
    session.role === "SHIPPER"
      ? prisma.auction.count({ where: { shipperId: session.userId } })
      : Promise.resolve(0),
    session.role === "CARRIER"
      ? prisma.bid.count({ where: { carrierId: session.userId } })
      : Promise.resolve(0),
  ]);

  return (
    <>
      <TopAppBar title="Profile" />

      <AppScreen>
        <section className="flex flex-col items-center gap-stack-sm pt-stack-sm text-center">
          <Avatar src={session.profileImage} name={session.name} size="lg" />

          <div className="flex flex-col gap-unit">
            <h2 className="font-headline-md text-headline-md text-on-surface">{session.name}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">{session.email}</p>
          </div>

          {/* The badge carries the word, not just a colour (§7.7). */}
          <Badge tone={session.role === "SHIPPER" ? "brand" : "success"}>
            {session.role === "SHIPPER" ? "Shipper" : "Carrier"}
          </Badge>
        </section>

        <section className="rounded-lg border border-surface-variant bg-surface-container-lowest p-stack-md shadow-[0_4px_12px_rgba(0,33,83,0.08)]">
          <dl className="flex flex-col gap-stack-sm">
            {session.role === "SHIPPER" ? (
              <Row icon="local_shipping" label="Loads posted" value={String(auctionCount)} />
            ) : (
              <Row icon="gavel" label="Bids placed" value={String(bidCount)} />
            )}
            <Row
              icon="badge"
              label="Account"
              value={session.role === "SHIPPER" ? "Shipper account" : "Carrier account"}
            />
          </dl>

          <p className="mt-stack-md font-body-md text-body-md text-on-surface-variant">
            Your role is set once when you sign up and can&apos;t be changed — switching would orphan
            your {session.role === "SHIPPER" ? "auctions" : "bids"}.
          </p>
        </section>

        <SignOutButton />
      </AppScreen>

      <MobileNav role={session.role} />
    </>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-stack-sm">
      <dt className="flex items-center gap-stack-sm font-body-md text-body-md text-on-surface-variant">
        <Icon name={icon} className="text-[18px]" />
        {label}
      </dt>
      <dd className="font-body-lg text-body-lg text-on-surface">{value}</dd>
    </div>
  );
}
