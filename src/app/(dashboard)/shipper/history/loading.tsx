import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { SkeletonBlock } from "@/components/ui/skeleton";

/** History loading state (§7.5), matching the real row geometry. */
export default function ShipperHistoryLoading() {
  return (
    <>
      <TopAppBar title="History" />

      <AppScreen>
        <div className="flex flex-col gap-stack-md" aria-busy="true" aria-label="Loading history">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} variant="card" lines={4} />
          ))}
        </div>
      </AppScreen>

      <MobileNav role="SHIPPER" />
    </>
  );
}
