"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { submitBid } from "@/lib/actions/bid";
import { cn } from "@/lib/design/cn";
import { formatINR } from "@/lib/format";

import { BidSuccess } from "./bid-success";

/**
 * Stitch `69e048b55c6a46a78c57fff5d52fdf6e` — the bid entry half of the screen.
 *
 * Flow: type an amount → tap Submit → confirm in a bottom `Sheet` (§7.6, this
 * is irreversible) → the action writes → the success screen replaces the form
 * in place. No toast: §7.6 says a screen that commits something shows a
 * success *screen*.
 *
 * Every validation here is duplicated server-side in `submitBid`, and the
 * server's copy is the real one. This exists to fail fast, not to be trusted.
 */
export function BidForm({
  auctionId,
  pickupLocation,
  dropoffLocation,
  lowestBid,
  myLowestBid,
  expired,
}: {
  auctionId: string;
  pickupLocation: string;
  dropoffLocation: string;
  /** Lowest live bid across all carriers, or null when there are none. */
  lowestBid: number | null;
  /** This carrier's own lowest so far — the number they must undercut. */
  myLowestBid: number | null;
  /** Server-computed at render. The `Timer` refreshes the page at zero. */
  expired: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (submitted !== null) {
    return (
      <BidSuccess
        amount={submitted}
        pickupLocation={pickupLocation}
        dropoffLocation={dropoffLocation}
      />
    );
  }

  const parsedAmount = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const undercuts = myLowestBid === null || (valid && parsedAmount < myLowestBid);
  const canSubmit = valid && undercuts && !expired && !pending;

  function review() {
    setError(null);

    if (!valid) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (myLowestBid !== null && parsedAmount >= myLowestBid) {
      setError(`Your bid must be lower than your current bid of ${formatINR(myLowestBid)}.`);
      return;
    }

    setConfirming(true);
  }

  function confirm() {
    startTransition(async () => {
      const result = await submitBid({ auctionId, amount: parsedAmount });

      if (result.ok) {
        setConfirming(false);
        setSubmitted(result.data.amount);
      } else {
        // The server rejected it — expired, already undercut, wrong role. Close
        // the sheet so the message is visible against the form it belongs to.
        setConfirming(false);
        setError(result.error);
      }
    });
  }

  return (
    <>
      <div className="mt-stack-lg flex flex-col items-center justify-center">
        <label
          htmlFor="bid-amount"
          className="mb-stack-sm font-label-bold text-label-bold uppercase tracking-wider text-secondary"
        >
          Your Bid Amount
        </label>

        <div className="relative w-full max-w-[280px]">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-display-price text-display-price text-on-surface">
            ₹
          </span>
          <input
            id="bid-amount"
            name="amount"
            type="number"
            // decimal, not numeric: gives the iOS keypad a decimal separator.
            inputMode="decimal"
            min="1"
            step="1"
            placeholder="0"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "bid-error" : "bid-hint"}
            className={cn(
              "block w-full rounded-lg border-2 bg-surface-container-lowest py-4 pr-4 pl-12",
              "text-center font-display-price text-display-price text-on-surface",
              "placeholder:text-outline-variant focus:ring-0 focus:outline-none",
              error ? "border-error" : "border-outline-variant focus:border-primary",
            )}
          />
        </div>

        {error ? (
          <p
            id="bid-error"
            role="alert"
            className="mt-stack-sm text-center font-body-md text-body-md text-error"
          >
            {error}
          </p>
        ) : (
          <p
            id="bid-hint"
            className="mt-stack-sm flex items-center gap-1 font-body-md text-body-md text-secondary"
          >
            <Icon name="trending_down" className="text-icon-md text-tertiary" />
            {lowestBid === null ? (
              "Be the first to bid"
            ) : (
              <>
                Current lowest bid is{" "}
                <span className="font-headline-md text-on-surface">{formatINR(lowestBid)}</span>
              </>
            )}
          </p>
        )}

        {myLowestBid !== null ? (
          <p className="mt-stack-sm font-body-md text-body-md text-on-surface-variant">
            Your current bid is {formatINR(myLowestBid)} — a new one must be lower.
          </p>
        ) : null}
      </div>

      {/* Sticky footer: the CTA has to stay in the thumb zone with the numeric keypad open. */}
      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-outline-variant bg-surface-container-lowest px-margin-mobile pt-stack-sm pb-safe shadow-[0_-4px_16px_rgba(0,34,80,0.1)]">
        <div className="mb-stack-sm flex items-center justify-center gap-1 text-error">
          <Icon name="warning" filled className="text-icon-md" />
          <p className="font-label-bold text-label-bold uppercase tracking-wide">
            Bids cannot be canceled once submitted
          </p>
        </div>

        <div className="pb-stack-md">
          <Button size="lg" fullWidth onClick={review} disabled={!canSubmit}>
            {expired ? "Auction closed" : "Submit Bid"}
          </Button>
        </div>
      </div>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirm your bid"
        description="Bids cannot be canceled once submitted."
        footer={
          <div className="flex flex-col gap-stack-sm pb-stack-sm">
            <Button size="lg" fullWidth loading={pending} onClick={confirm}>
              Yes, submit {valid ? formatINR(parsedAmount) : ""}
            </Button>
            <Button size="lg" fullWidth variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-stack-sm rounded-lg bg-surface-container-low p-gutter-mobile">
          <Row label="Your bid" value={valid ? formatINR(parsedAmount) : "—"} emphasis />
          <Row label="Route" value={`${pickupLocation} → ${dropoffLocation}`} />
          {lowestBid !== null ? (
            <Row label="Current lowest" value={formatINR(lowestBid)} />
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-stack-sm">
      <span className="font-body-md text-body-md text-on-surface-variant">{label}</span>
      <span
        className={cn(
          "truncate text-right",
          emphasis
            ? "font-headline-md text-headline-md text-on-surface"
            : "font-body-md text-body-md text-on-surface",
        )}
      >
        {value}
      </span>
    </div>
  );
}
