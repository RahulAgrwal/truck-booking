"use server";

import type { ActionResult } from "@/lib/schemas";

/**
 * Rate the other party on a completed job.
 *
 * STUB — `B4` implements it. The signature is what `A4`'s rate sheet builds
 * against; the body refuses, because a review that silently did nothing would
 * be worse than one that says it cannot yet.
 *
 * When it is real, its authorization *is* Rule 1: `getDeal(...) === null`
 * ⇒ refuse. You can only review someone you demonstrably transacted with, so
 * there is no second permission model to keep in sync with the first.
 */
export async function submitReview(input: unknown): Promise<ActionResult> {
  void input;
  return { ok: false, error: "Not available yet." };
}
