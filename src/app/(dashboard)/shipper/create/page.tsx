import Link from "next/link";

import { AppScreen } from "@/components/app-shell";
import { requireRole } from "@/lib/session";

import { AuctionForm } from "./auction-form";

/**
 * Stitch screen 5351d3902a5149ed91c6e59678e51bd1 — "Create Auction Form".
 *
 * No bottom nav: this is a transactional flow that ends in a sticky footer
 * button, so `AppScreen` gets `hasNav={false}` (Lane B's handoff, B0).
 * The header is a back arrow and a centred title rather than the standard
 * TopAppBar, matching the Stitch markup.
 */
export default async function CreateAuctionPage() {
  await requireRole("SHIPPER");

  return (
    <>
      <header className="pt-safe fixed top-0 left-0 z-50 w-full border-b border-outline-variant bg-surface">
        <div className="flex h-touch-target-min items-center px-margin-mobile">
          <Link
            href="/shipper"
            aria-label="Go back"
            className="-ml-3 flex h-touch-target-min w-touch-target-min items-center justify-center rounded-full text-on-surface-variant active:opacity-80"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
          </Link>
          <h1 className="flex-1 pr-[48px] text-center font-headline-md text-headline-md text-on-surface">
            Post a Load
          </h1>
        </div>
      </header>

      <AppScreen hasNav={false} className="space-y-stack-lg pb-[120px]">
        <AuctionForm />
      </AppScreen>
    </>
  );
}
