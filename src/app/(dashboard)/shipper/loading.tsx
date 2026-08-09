import {
  AppScreen,
  AvatarPlaceholder,
  NotificationBell,
  TopAppBar,
  Wordmark,
} from "@/components/app-shell";
import { MobileNav } from "@/components/mobile-nav";
import { SkeletonList } from "@/components/ui/skeleton";

/**
 * Skeleton mirrors the real card geometry so the layout does not jump when the
 * data lands — the chrome is identical to page.tsx, only the cards are stubs.
 *
 * The app bar has to hold to that too, and previously did not: it drew the
 * wordmark alone, so the avatar and the bell both popped in on load and the
 * wordmark slid 40px right. `AvatarPlaceholder` reserves the avatar's 32px.
 */
export default function Loading() {
  return (
    <>
      <TopAppBar
        leading={<AvatarPlaceholder />}
        title={<Wordmark />}
        trailing={<NotificationBell />}
      />
      <AppScreen>
        <h2 className="font-headline-md text-headline-md text-on-surface">Active Auctions</h2>
        <SkeletonList count={3} />
      </AppScreen>
      <MobileNav role="SHIPPER" />
    </>
  );
}
