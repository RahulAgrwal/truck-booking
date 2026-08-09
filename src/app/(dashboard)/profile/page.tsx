import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { RatingStars } from "@/components/rating-stars";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { formatRelativeTime, ratingAverage } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { raterSelect, reviewsFor } from "@/lib/reviews";
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
  const [auctionCount, bidCount, me, reviews] = await Promise.all([
    session.role === "SHIPPER"
      ? prisma.auction.count({ where: { shipperId: session.userId } })
      : Promise.resolve(0),
    session.role === "CARRIER"
      ? prisma.bid.count({ where: { carrierId: session.userId } })
      : Promise.resolve(0),
    // `raterSelect` carries the rating aggregate. Not a contact column, so this
    // is outside Rule 1 — reputation is public by design (§2, Rule 2).
    prisma.user.findUnique({ where: { id: session.userId }, select: raterSelect }),
    reviewsFor(session.userId),
  ]);

  const ratingCount = me?.ratingCount ?? 0;
  const average = ratingAverage(me?.ratingSum ?? 0, ratingCount);

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

        {/*
          The way into the edit form. Deliberately a navigation row rather than
          the values themselves: the full details section, with the rating
          block beside it, is A5's job. Until then this makes the route
          reachable, which an unreachable screen is not.
        */}
        <Link
          href="/profile/details"
          className="flex h-touch-target-min items-center justify-between gap-stack-sm rounded-lg border border-surface-variant bg-surface-container-lowest px-stack-md shadow-[0_4px_12px_rgba(0,33,83,0.08)] transition-transform active:scale-[0.98]"
        >
          <span className="flex items-center gap-stack-sm font-body-lg text-body-lg text-on-surface">
            <Icon name="contact_phone" className="text-[18px]" />
            Contact details
          </span>
          <Icon name="chevron_right" className="text-on-surface-variant" />
        </Link>

        {/*
          Reputation — shape from Mobbin's Depop and iFood review tabs: the
          average large and first, then what people actually wrote.

          This is what the other side sees when deciding whether to deal with
          you, so it is shown to you unedited. There is no way to delete a
          review from here, and there should not be one.
        */}
        <section className="flex flex-col gap-stack-md rounded-lg border border-surface-variant bg-surface-container-lowest p-stack-md shadow-[0_4px_12px_rgba(0,33,83,0.08)]">
          <div className="flex items-center justify-between gap-stack-sm">
            <h3 className="font-headline-md text-headline-md text-on-surface">Your rating</h3>
            <RatingStars average={average} count={ratingCount} size="md" />
          </div>

          {ratingCount === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              {session.role === "SHIPPER"
                ? "Carriers rate you once a load is delivered. Nobody has rated you yet."
                : "Shippers rate you once a load is delivered. Nobody has rated you yet."}
            </p>
          ) : reviews.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              No written comments yet — your score comes from{" "}
              {ratingCount === 1 ? "1 rating" : `${ratingCount} ratings`}.
            </p>
          ) : (
            <ul className="flex list-none flex-col gap-stack-sm p-0">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="flex flex-col gap-unit rounded bg-surface-container-low p-3"
                >
                  <div className="flex items-center justify-between gap-stack-sm">
                    <RatingStars average={review.stars} count={1} showCount={false} />
                    <span className="shrink-0 font-body-md text-body-md text-on-surface-variant">
                      {formatRelativeTime(review.createdAt)}
                    </span>
                  </div>
                  {review.comment ? (
                    <p className="font-body-md text-body-md text-on-surface">{review.comment}</p>
                  ) : null}
                  <p className="font-label-bold text-label-bold text-on-surface-variant">
                    — {review.authorName}
                  </p>
                </li>
              ))}
            </ul>
          )}
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
