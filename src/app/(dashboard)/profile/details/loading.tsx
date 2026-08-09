import { Skeleton } from "@/components/ui/skeleton";

/**
 * Edit-details loading state (§7.5).
 *
 * Matches the real screen's geometry — local back-arrow header, one intro
 * paragraph, then a stack of 48px fields — so the layout does not jump when the
 * prefill arrives. The sticky save bar is drawn too: it is fixed, so leaving it
 * out would let the last skeleton field sit where the button is about to be.
 */
export default function EditDetailsLoading() {
  return (
    <>
      <header className="relative flex h-touch-target-min w-full shrink-0 items-center justify-center bg-surface px-margin-mobile pt-safe">
        <h1 className="font-headline-md text-headline-md text-on-surface">Contact details</h1>
      </header>

      <main
        className="flex min-h-screen flex-1 flex-col px-margin-mobile pt-stack-md pb-[100px]"
        aria-busy="true"
        aria-label="Loading your contact details"
      >
        <Skeleton className="mb-stack-lg h-10 w-full rounded" />

        <div className="flex flex-col gap-stack-lg">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex flex-col gap-stack-sm">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-touch-target-min w-full rounded-lg" />
            </div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-outline-variant bg-surface pb-safe">
        <div className="p-margin-mobile">
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </>
  );
}
