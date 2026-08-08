import { AppScreen, TopAppBar } from "@/components/app-shell";
import { Skeleton, SkeletonBlock } from "@/components/ui/skeleton";

/**
 * Profile loading state (§7.5).
 *
 * No `MobileNav` here, unlike the other loading screens: the nav needs a role,
 * and the role is exactly what this page is still waiting on. Guessing one
 * would light the wrong three tabs for half a second.
 */
export default function ProfileLoading() {
  return (
    <>
      <TopAppBar title="Profile" />

      <AppScreen>
        <div
          className="flex flex-col gap-stack-md"
          aria-busy="true"
          aria-label="Loading your profile"
        >
          <div className="flex flex-col items-center gap-stack-sm pt-stack-sm">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          <SkeletonBlock variant="card" lines={3} />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </AppScreen>
    </>
  );
}
