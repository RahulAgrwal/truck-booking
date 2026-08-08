import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { Skeleton, SkeletonBlock } from "@/components/ui/skeleton";

/** Auction-details loading state (§7.5): summary card, then the bid list. */
export default function ShipperAuctionLoading() {
  return (
    <>
      <TopAppBar title="TruckingGO" />

      <AppScreen className="gap-stack-lg">
        <SkeletonBlock variant="card" lines={4} />

        <div className="flex flex-col gap-stack-md" aria-busy="true" aria-label="Loading bids">
          <Skeleton className="h-7 w-40" />
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} variant="card" lines={3} />
          ))}
        </div>
      </AppScreen>

      <MobileNav role="SHIPPER" />
    </>
  );
}
