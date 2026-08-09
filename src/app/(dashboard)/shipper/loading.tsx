import { AppScreen, TopAppBar } from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { SkeletonList } from "@/components/ui/skeleton";

/**
 * Skeleton mirrors the real card geometry so the layout does not jump when the
 * data lands — the chrome is identical to page.tsx, only the cards are stubs.
 */
export default function Loading() {
  return (
    <>
      <TopAppBar
        title={
          <span className="font-headline-lg text-headline-lg tracking-tight text-primary">
            TruckingGO
          </span>
        }
      />
      <AppScreen>
        <h2 className="font-headline-md text-headline-md text-on-surface">Active Auctions</h2>
        <SkeletonList count={3} />
      </AppScreen>
      <MobileNav role="SHIPPER" />
    </>
  );
}
