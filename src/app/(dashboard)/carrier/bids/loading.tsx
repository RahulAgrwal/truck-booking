import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { Skeleton, SkeletonBlock } from "@/components/ui/skeleton";

/** My Bids loading state (§7.5). Same geometry as the real rows. */
export default function MyBidsLoading() {
  return (
    <>
      <TopAppBar title="My Bids" />

      <AppScreen>
        <div className="flex gap-stack-sm">
          <Skeleton className="h-touch-target-min w-28 rounded-full" />
          <Skeleton className="h-touch-target-min w-20 rounded-full" />
          <Skeleton className="h-touch-target-min w-20 rounded-full" />
        </div>

        <div className="flex flex-col gap-stack-md" aria-busy="true" aria-label="Loading your bids">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} variant="card" lines={4} />
          ))}
        </div>
      </AppScreen>

      <MobileNav role="CARRIER" />
    </>
  );
}
