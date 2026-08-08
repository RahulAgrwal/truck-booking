import { Skeleton, SkeletonBlock } from "@/components/ui/skeleton";

/**
 * Place-a-bid loading state (§7.5). Mirrors the real screen's geometry: header,
 * summary card, the centred amount field, and the sticky footer — so nothing
 * shifts when the auction lands.
 */
export default function PlaceBidLoading() {
  return (
    <>
      <header className="flex h-touch-target-min w-full shrink-0 items-center justify-center bg-surface px-margin-mobile pt-safe">
        <span className="font-headline-md text-headline-md text-on-surface">Submit Bid</span>
      </header>

      <main
        className="flex-1 px-margin-mobile pt-stack-sm pb-[calc(env(safe-area-inset-bottom,0px)+160px)]"
        aria-busy="true"
        aria-label="Loading load details"
      >
        <SkeletonBlock variant="card" lines={5} className="mb-stack-lg" />

        <div className="mt-stack-lg flex flex-col items-center gap-stack-sm">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[72px] w-full max-w-[280px] rounded-lg" />
          <Skeleton className="h-4 w-48" />
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full border-t border-outline-variant bg-surface-container-lowest px-margin-mobile pt-stack-sm pb-safe">
        <div className="pb-stack-md">
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </>
  );
}
