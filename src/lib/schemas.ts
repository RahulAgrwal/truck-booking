import { z } from "zod";

/**
 * Every zod schema in the app, in one place so both lanes import the same
 * definitions. Lane A owns this file; Lane B consumes SubmitBidSchema in B4.
 *
 * Server Actions parse with these before touching the database — never trust a
 * client-supplied value (CLAUDE.md §3.2).
 */

/** Result shape every Server Action returns. Expected failures do not throw. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export const RoleSchema = z.enum(["SHIPPER", "CARRIER"]);

export const SetUserRoleSchema = z.object({
  role: RoleSchema,
});

/** Auction durations offered as chips on the create form. */
export const AUCTION_DURATIONS_HOURS = [1, 6, 12, 24] as const;

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

/**
 * Create-auction payload (TechnicalDocument.md §5.2).
 *
 * Coordinates come from Places Autocomplete and are therefore untrusted; they
 * are range-checked, then used only for the Distance Matrix lookup and display.
 * They are nullable because the autocomplete falls back to a plain text input
 * when no Maps key is configured (§10.3).
 */
export const CreateAuctionSchema = z.object({
  pickupLocation: z.string().trim().min(2).max(200),
  pickupLat: latitude.nullable(),
  pickupLng: longitude.nullable(),
  dropoffLocation: z.string().trim().min(2).max(200),
  dropoffLat: latitude.nullable(),
  dropoffLng: longitude.nullable(),
  materialDetails: z.string().trim().min(2).max(240),
  weightTons: z.coerce.number().positive().max(100),
  durationHours: z.union([z.literal(1), z.literal(6), z.literal(12), z.literal(24)]),
});

export type CreateAuctionInput = z.infer<typeof CreateAuctionSchema>;

/** Accept-bid payload (TechnicalDocument.md §5.4). */
export const AcceptBidSchema = z.object({
  auctionId: z.string().uuid(),
  bidId: z.string().uuid(),
});

/**
 * Submit-bid payload (TechnicalDocument.md §5.3) — consumed by Lane B in B4.
 * The amount cap is a sanity bound, not a business rule; the real constraints
 * (auction ACTIVE, not expired, not your own load, must undercut your previous
 * bid) are enforced server-side in the action.
 */
export const SubmitBidSchema = z.object({
  auctionId: z.string().uuid(),
  amount: z.coerce.number().positive().max(10_000_000),
});

export type SubmitBidInput = z.infer<typeof SubmitBidSchema>;

/** First zod issue as a flat `{ error, field }`, ready to return from an action. */
export function firstIssue(error: z.ZodError): { error: string; field?: string } {
  const issue = error.issues[0];
  if (!issue) return { error: "Invalid input." };
  const field = issue.path[0];
  return {
    error: issue.message,
    field: typeof field === "string" ? field : undefined,
  };
}
