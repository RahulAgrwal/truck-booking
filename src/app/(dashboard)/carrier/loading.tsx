import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { Skeleton, SkeletonBlock } from "@/components/ui/skeleton";

/**
 * Carrier feed loading state (§7.5).
 *
 * The chrome — app bar and nav — is drawn for real, not skeletoned: it is
 * identical on both sides of the load, so faking it would make it flicker.
 * Only the parts that depend on the query get placeholders, and they carry the
 * real card's geometry so nothing jumps when the data lands.
 */
export default function CarrierFeedLoading() {
  return (
    <>
      <TopAppBar title="TruckingGO" />

      <AppScreen>
        <div className="flex flex-col gap-stack-sm">
          <Skeleton className="h-touch-target-min w-full rounded-lg" />
          <div className="flex gap-stack-sm">
            <Skeleton className="h-touch-target-min w-16 rounded-full" />
            <Skeleton className="h-touch-target-min w-24 rounded-full" />
            <Skeleton className="h-touch-target-min w-32 rounded-full" />
          </div>
        </div>

        <div className="flex flex-col gap-stack-md" aria-busy="true" aria-label="Loading loads">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} variant="card" lines={5} />
          ))}
        </div>
      </AppScreen>

      <MobileNav role="CARRIER" />
    </>
  );
}
