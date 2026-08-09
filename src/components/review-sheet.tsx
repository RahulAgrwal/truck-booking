"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { submitReview } from "@/lib/actions/review";

import { StarRatingInput } from "./star-rating-input";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Sheet } from "./ui/sheet";
import { Textarea } from "./ui/input";

/**
 * Rate the other party on a completed job.
 *
 * Shape from Mobbin's post-transaction rating sheets (Grailed "Rate Your
 * Purchase", Grab "Rate your experience"): stars first and large, an optional
 * comment under them, one sticky submit.
 *
 * **One review per party per job, and it cannot be edited.** That is enforced
 * by a unique constraint in the database, not by hiding this button — two taps
 * race, and the loser gets a friendly message rather than a duplicate. Hiding
 * the control once `alreadyReviewed` is true is a courtesy on top of the
 * constraint, never instead of it.
 *
 * Authorization is `getDeal` inside the action: you can only review someone you
 * demonstrably transacted with. This component checks nothing.
 */
export function ReviewSheet({
  auctionId,
  subjectName,
  alreadyReviewed,
}: {
  auctionId: string;
  /** Who is being rated — named in the prompt, so it never reads as generic. */
  subjectName: string;
  alreadyReviewed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
    Already rated: a done state, not a hidden one. Removing the row entirely
    would leave the screen looking as though rating had never been offered,
    and the shipper would wonder whether their rating saved.
  */
  if (alreadyReviewed) {
    return (
      <p className="flex items-center justify-center gap-stack-sm rounded-lg bg-surface-container-low p-gutter-mobile font-body-md text-body-md text-on-surface-variant">
        <Icon name="check_circle" filled className="text-tertiary" />
        You&apos;ve rated this job. Thanks — it helps the next person choose.
      </p>
    );
  }

  function confirm() {
    setError(null);

    startTransition(async () => {
      const result = await submitReview({
        auctionId,
        stars,
        // An empty box is "no comment", not an empty comment.
        comment: comment.trim() === "" ? undefined : comment.trim(),
      });

      if (result.ok) {
        setOpen(false);
        // The page re-reads `iReviewed` and swaps this for the done state.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="lg" fullWidth onClick={() => setOpen(true)}>
        Rate {subjectName}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`How did it go with ${subjectName}?`}
        description="Your rating is public and can't be changed later. One rating per job."
        footer={
          <div className="flex flex-col gap-stack-sm pb-stack-sm">
            <Button
              size="lg"
              fullWidth
              loading={pending}
              // Stars are the review; a comment is optional. Guarding here is
              // a courtesy — the schema refuses 0 regardless.
              disabled={stars === 0}
              onClick={confirm}
            >
              {stars === 0 ? "Choose a rating" : "Submit rating"}
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
        <div className="flex flex-col gap-stack-lg">
          <StarRatingInput
            value={stars}
            onChange={setStars}
            legend={`Rate ${subjectName} out of five`}
            disabled={pending}
          />

          <Textarea
            label="Add a comment (optional)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            hint="What went well, or what didn't. Other users will read this."
            maxLength={400}
            rows={3}
            disabled={pending}
          />

          {error ? (
            <p role="alert" className="font-label-bold text-label-bold text-error">
              {error}
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
