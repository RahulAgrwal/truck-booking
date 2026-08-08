import { EmptyState } from "@/components/ui/empty-state";

/**
 * 404 (§7.5).
 *
 * Reached by a mistyped URL, and by `notFound()` from a detail page whose id
 * does not resolve — a carrier opening a bookmarked auction that has since been
 * deleted lands here.
 *
 * Sends everyone to `/` rather than to a role's home: this renders outside any
 * role guard, so it cannot know whether the visitor is a shipper, a carrier, or
 * signed out. `/` redirects by session and gets it right.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-margin-mobile pt-safe pb-safe">
      <EmptyState
        icon="wrong_location"
        title="Page not found"
        body="That link doesn't lead anywhere. It may have expired, or the load may have been removed."
        cta={{ label: "Take me back", href: "/" }}
      />
    </main>
  );
}
