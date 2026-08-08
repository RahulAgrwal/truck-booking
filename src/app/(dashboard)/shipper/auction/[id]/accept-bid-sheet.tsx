"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { acceptBid } from "@/lib/actions/auction";
import { cn } from "@/lib/design/cn";
import { formatINR } from "@/lib/format";

/**
 * "Accept Bid", behind a bottom-sheet confirm (§7.6).
 *
 * Accepting is the most irreversible action in the app: it closes the auction,
 * marks one bid ACCEPTED and every other REJECTED, and §3.2 has no arrow back
 * out of `COMPLETED_ASSIGNED`. So the sheet spells out who and how much before
 * anything is written.
 *
 * The button being visible is not what authorises this — `acceptBid` re-checks
 * ownership and status inside a serializable transaction (§5.4). If the auction
 * closed while the sheet was open, the action refuses and the page refreshes.
 */
export function AcceptBidSheet({
  auctionId,
  bidId,
  carrierName,
  amount,
  isBest,
}: {
  auctionId: string;
  bidId: string;
  carrierName: string;
  amount: number;
  isBest: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await acceptBid({ auctionId, bidId });

      if (result.ok) {
        setOpen(false);
        // No success screen here, unlike the carrier's bid flow: the shipper
        // stays on this page and watches it become the assigned state.
        router.refresh();
      } else {
        setOpen(false);
        setError(result.error);
        // "This auction just closed" is only true if the page is stale, so
        // pull the real state in behind the message.
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        variant={isBest ? "primary" : "secondary"}
        size="lg"
        fullWidth
        onClick={() => setOpen(true)}
        className={cn(isBest && "bg-tertiary-container text-on-tertiary-container")}
      >
        Accept Bid
      </Button>

      {error ? (
        <p role="alert" className="mt-stack-sm font-body-md text-body-md text-error">
          {error}
        </p>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Accept this bid?"
        description="This closes the auction immediately. Every other bid is rejected, and it can't be undone."
        footer={
          <div className="flex flex-col gap-stack-sm pb-stack-sm">
            <Button size="lg" fullWidth loading={pending} onClick={confirm}>
              Yes, accept {formatINR(amount)}
            </Button>
            <Button
              size="lg"
              fullWidth
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-stack-sm rounded-lg bg-surface-container-low p-stack-md">
          <div className="flex items-baseline justify-between gap-stack-sm">
            <span className="font-body-md text-body-md text-on-surface-variant">Carrier</span>
            <span className="truncate text-right font-body-lg text-body-lg text-on-surface">
              {carrierName}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-stack-sm">
            <span className="font-body-md text-body-md text-on-surface-variant">Agreed price</span>
            <span className="font-headline-md text-headline-md text-on-surface">
              {formatINR(amount)}
            </span>
          </div>
        </div>
      </Sheet>
    </>
  );
}
