import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DetailsForm, type DetailsFormValues } from "@/app/(auth)/onboarding/details/details-form";
import { Icon } from "@/components/ui/icon";
import { getOwnContactDetails } from "@/lib/contact";
import { TRUCK_TYPES, type TruckType } from "@/lib/schemas";
import { requireSession } from "@/lib/session";

/**
 * Edit your contact details.
 *
 * The same `DetailsForm` as onboarding step 2, in `mode="edit"` — the fields,
 * the validation and the action are identical, so a second copy would only
 * drift the first time a field is added.
 *
 * The prefill comes from `getOwnContactDetails` in Lane B's `contact.ts` rather
 * than a query here. Reading your own details is not a Rule 1 question at all —
 * the session *is* the authorization — but keeping the select in that one
 * module is what lets the Rule 1 grep stay total: any `select` of a contact
 * column under `src/app/` is a bug, with no "except this one" to reason about.
 *
 * Local chrome, not `TopAppBar`: this is a pushed, transactional screen with a
 * back arrow, the same shape as the carrier's bid screen.
 */
export const dynamic = "force-dynamic";

export default async function EditDetailsPage() {
  const session = await requireSession();

  // No role means onboarding is not finished; there is nothing to edit yet.
  if (session.role === null) redirect("/onboarding");

  const details = await getOwnContactDetails(session.userId);
  if (!details) notFound();

  /*
    `truckType` is a free `string | null` on the way out of the database but a
    closed union on the way into the form. Narrow it here rather than casting:
    a value that is no longer in TRUCK_TYPES (a type retired since the carrier
    signed up) becomes "nothing selected", which is honest and recoverable —
    a cast would render a chip row with nothing highlighted and no way to tell
    why.
  */
  const truckType: TruckType | "" =
    TRUCK_TYPES.find((type) => type === details.truckType) ?? "";

  const initial: DetailsFormValues = {
    phone: details.phone ?? "",
    address: details.address ?? "",
    companyName: details.companyName ?? "",
    truckNumber: details.truckNumber ?? "",
    truckType,
  };

  return (
    <>
      <header className="relative flex h-touch-target-min w-full shrink-0 items-center justify-center bg-surface px-margin-mobile pt-safe">
        <Link
          href="/profile"
          aria-label="Back to profile"
          className="absolute left-margin-mobile flex h-touch-target-min w-touch-target-min items-center justify-center rounded-full text-on-surface active:opacity-80"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="font-headline-md text-headline-md text-on-surface">Contact details</h1>
      </header>

      <main className="flex min-h-screen flex-1 flex-col px-margin-mobile pt-stack-md pb-[100px]">
        <p className="mb-stack-lg font-body-md text-body-md text-on-surface-variant">
          Shared with the other party only after a bid is accepted — never before, and never with anyone
          else.
        </p>

        <DetailsForm role={session.role} mode="edit" initial={initial} />
      </main>
    </>
  );
}
