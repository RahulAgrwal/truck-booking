import { z } from "zod";

import { normalizePhone, normalizeTruckNumber } from "@/lib/format";

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

/**
 * Route-preview payload — the create form asking "how far is this?" before the
 * shipper commits (TechnicalDocument.md §10.2).
 *
 * Non-nullable, unlike the create payload: there is nothing to preview until
 * both ends are geocoded, so the caller simply doesn't ask.
 */
export const RoutePreviewSchema = z.object({
  pickupLat: latitude,
  pickupLng: longitude,
  dropoffLat: latitude,
  dropoffLng: longitude,
});

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

/* ------------------------------------------------------------------ *
 * Contact details + reviews (docs/feature-contact-ratings.md §4).
 * ------------------------------------------------------------------ */

/** Indian mobile: ten bare digits starting 6–9. Tested against the *normalised* value. */
export const PHONE_RE = /^[6-9]\d{9}$/;

/** Indian commercial plate, e.g. MH12AB1234. Tolerates the spaced form too. */
export const TRUCK_NUMBER_RE = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}$/;

/**
 * Body types offered on the carrier details form.
 *
 * A closed list rather than free text: `truckType` is shown to a shipper as a
 * fact about the vehicle they hired, so "Container", "container" and "cntnr"
 * being three different answers would make it worthless — and a chip row is
 * the design system's answer to a short enumeration anyway. Extend the list
 * rather than loosening the schema.
 */
export const TRUCK_TYPES = [
  "Open Body",
  "Container",
  "Trailer",
  "Tipper",
  "Tanker",
  "Refrigerated",
] as const;

export type TruckType = (typeof TRUCK_TYPES)[number];

/**
 * Phone is normalised *before* it is validated, so "+91 98765 43210" and
 * "09876543210" are the same input as far as the rule is concerned, and what
 * lands in the database is always the canonical ten digits.
 */
const phoneField = z
  .string()
  .trim()
  .min(1, "Enter your mobile number.")
  .transform(normalizePhone)
  .refine((value) => PHONE_RE.test(value), "Enter a valid 10-digit Indian mobile number.");

const addressField = z
  .string()
  .trim()
  .min(5, "Enter your address.")
  .max(200, "Address must be 200 characters or fewer.");

const truckNumberField = z
  .string()
  .trim()
  .min(1, "Enter your truck number.")
  .transform(normalizeTruckNumber)
  .refine((value) => TRUCK_NUMBER_RE.test(value), "Enter a valid truck number, e.g. MH12AB1234.");

export const ShipperDetailsSchema = z.object({
  role: z.literal("SHIPPER"),
  phone: phoneField,
  address: addressField,
  companyName: z
    .string()
    .trim()
    .min(2, "Enter your company name.")
    .max(120, "Company name must be 120 characters or fewer."),
});

export const CarrierDetailsSchema = z.object({
  role: z.literal("CARRIER"),
  phone: phoneField,
  address: addressField,
  truckNumber: truckNumberField,
  truckType: z.enum(TRUCK_TYPES, { message: "Choose a truck type." }),
});

/**
 * Discriminated, not optional-everything: a carrier cannot submit a shipper
 * payload, and the action never has to guess which branch it is looking at.
 * The action still checks the branch against the *session* role — the client
 * chooses the shape, never the identity (CLAUDE.md §3.2).
 */
export const ContactDetailsSchema = z.discriminatedUnion("role", [
  ShipperDetailsSchema,
  CarrierDetailsSchema,
]);

export type ContactDetailsInput = z.infer<typeof ContactDetailsSchema>;

/** Rate the other party on a completed job. One review per party per job. */
export const SubmitReviewSchema = z.object({
  auctionId: z.string().uuid(),
  stars: z.coerce.number().int().min(1, "Choose a rating.").max(5),
  comment: z.string().trim().max(400, "Keep your review to 400 characters.").optional(),
});

export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;

/**
 * Read one carrier's recent reviews, fetched when the accept-bid sheet opens.
 *
 * `take` is bounded even though the caller is our own sheet: it reaches the
 * server as an untrusted number like any other, and an unbounded one is a way
 * to ask for every review a carrier has ever received.
 */
export const CarrierReviewsSchema = z.object({
  carrierId: z.string().uuid(),
  take: z.coerce.number().int().min(1).max(20).optional(),
});

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
