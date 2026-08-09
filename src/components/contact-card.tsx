import type { DealParty } from "@/lib/contact";
import { cn } from "@/lib/design/cn";
import { formatPhone, formatTruckNumber, ratingAverage, telHref } from "@/lib/format";

import { RatingStars } from "./rating-stars";
import { Avatar } from "./ui/avatar";
import { Icon } from "./ui/icon";

/**
 * The other party on a completed deal — the payoff of the whole feature.
 *
 * Shape from Mobbin's post-booking driver cards (inDrive "Your chosen driver",
 * Bolt's driver sheet): who, how good they are, what they are driving, and one
 * unmissable way to call them.
 *
 * **It renders only what `getDeal` returned.** Rule 1 was already decided in
 * `src/lib/contact.ts`; this component performs no check of its own, because a
 * second permission model is a second thing to get wrong. Handed `null` it
 * renders nothing at all — not a locked card, not "contact hidden", which would
 * tell a losing carrier that a winner exists.
 *
 * The call button is the primary action and it is a plain `tel:` link. Note
 * `layout.tsx` sets `formatDetection.telephone: false` — that stops iOS
 * auto-linking ₹ amounts and countdown digits, and does not affect an explicit
 * anchor like this one.
 */
export function ContactCard({
  party,
  title,
  className,
}: {
  /** From `getDeal`. Pass `null` and the card disappears. */
  party: DealParty | null;
  /** e.g. "Your carrier" / "Your shipper". */
  title: string;
  className?: string;
}) {
  if (!party) return null;

  const isCarrier = party.role === "CARRIER";
  const average = ratingAverage(party.ratingSum, party.ratingCount);

  return (
    <section
      className={cn(
        "flex flex-col gap-stack-md rounded-lg border border-surface-variant bg-surface-container-lowest p-gutter-mobile",
        "shadow-[0_4px_12px_rgba(0,33,83,0.08)]",
        className,
      )}
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-stack-sm">
        <span className="font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
          {title}
        </span>
        <span className="flex items-center gap-1 font-label-bold text-label-bold text-tertiary">
          <Icon name="verified" filled className="text-icon-md" />
          Confirmed
        </span>
      </div>

      <div className="flex items-center gap-stack-md">
        <Avatar src={party.profileImage} name={party.name} size="lg" />
        <div className="flex min-w-0 flex-col gap-unit">
          <span className="truncate font-headline-md text-headline-md text-on-surface">
            {party.name}
          </span>
          {party.companyName && !isCarrier ? (
            <span className="truncate font-body-md text-body-md text-on-surface-variant">
              {party.companyName}
            </span>
          ) : null}
          <RatingStars average={average} count={party.ratingCount} />
        </div>
      </div>

      {/*
        The truck, for a carrier. A registration plate is the one field that has
        to survive being read aloud over a bad phone line and matched against a
        vehicle at a gate, so it gets the plate treatment — spaced groups, wide
        tracking, its own bordered box — rather than sitting in a sentence.
      */}
      {isCarrier && party.truckNumber ? (
        <div className="flex items-center gap-stack-md rounded bg-surface-container-low p-stack-sm">
          <Icon name="local_shipping" filled className="text-on-surface-variant" />
          <div className="flex min-w-0 flex-col gap-unit">
            <span className="font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
              Vehicle
            </span>
            <span className="flex flex-wrap items-center gap-stack-sm">
              <span className="rounded border border-outline bg-surface-container-lowest px-2 py-1 font-label-bold text-label-bold tracking-[0.2em] text-on-surface">
                {formatTruckNumber(party.truckNumber)}
              </span>
              {party.truckType ? (
                <span className="font-body-md text-body-md text-on-surface-variant">
                  {party.truckType}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}

      {party.address ? (
        <div className="flex items-start gap-stack-md">
          <Icon name="location_on" className="mt-unit shrink-0 text-on-surface-variant" />
          <div className="flex min-w-0 flex-col gap-unit">
            <span className="font-label-bold text-label-bold uppercase tracking-wider text-on-surface-variant">
              {isCarrier ? "Based at" : "Pickup address"}
            </span>
            <span className="font-body-md text-body-md text-on-surface">{party.address}</span>
          </div>
        </div>
      ) : null}

      {/*
        The point of the screen. Full-width and 56px because on a phone the
        next thing that happens after a load is assigned is a phone call.
      */}
      {party.phone ? (
        <a
          href={telHref(party.phone)}
          className={cn(
            "inline-flex h-14 w-full items-center justify-center gap-stack-sm rounded-lg",
            "bg-primary-container font-headline-md text-headline-md text-on-primary-container",
            "transition-transform active:scale-95",
          )}
          aria-label={`Call ${party.name} on ${formatPhone(party.phone)}`}
        >
          <Icon name="call" filled />
          {formatPhone(party.phone)}
        </a>
      ) : (
        /*
          Details are required at onboarding, so this should be unreachable —
          but every user row that predates that migration has a null phone, and
          "no number on file" beats an empty space where a call button was.
        */
        <p className="rounded bg-surface-container-low p-stack-sm font-body-md text-body-md text-on-surface-variant">
          {party.name} hasn&apos;t added a phone number yet.
        </p>
      )}
    </section>
  );
}
